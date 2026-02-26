import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";
import CreateMessageService from "./CreateMessageService";
import { isValidMsg, getTypeMessage, getBodyMessage } from "../WbotServices/wbotMessageListener";
import {
  registerHistoryHandler,
  unregisterHistoryHandler,
  registerFetchRequest,
  startFetchRequest,
  cancelFetchRequest
} from "../../libs/messageHistoryHandler";
import { downloadMediaMessage, getContentType, extractMessageContent } from "@whiskeysockets/baileys";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);

// Tipos de mídia que podem ser baixados
const DOWNLOADABLE_MEDIA_TYPES = ["image", "video", "audio", "sticker", "document"];

/**
 * Baixa mídia de uma mensagem do history sync e salva no disco.
 * Reutiliza a mesma lógica de verifyMediaMessage/downloadMedia do wbotMessageListener.
 * Retorna null se o download falhar (mídia expirada, indisponível, etc).
 */
const downloadSyncMedia = async (
    msg: any,
    wbot: any,
    companyId: number,
    contactId: number
): Promise<{ mediaUrl: string; filename: string } | null> => {
    if (!msg?.message) return null;

    // Extrair informações de mídia
    const content = extractMessageContent(msg.message);
    if (!content) return null;

    const contentType = getContentType(content);
    if (!contentType) return null;

    // Verificar se é tipo de mídia baixável
    const mediaMessage = (content as any)[contentType];
    if (!mediaMessage || !mediaMessage.mimetype) return null;

    // Download do buffer via Baileys
    let buffer: Buffer;
    try {
        buffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            {
                logger,
                reuploadRequest: wbot.updateMediaMessage
            }
        ) as Buffer;
    } catch (err: any) {
        // Mídia provavelmente expirada ou indisponível
        logger.debug(`[SyncMedia] Download falhou para ${msg.key.id}: ${err?.message}`);
        return null;
    }

    if (!buffer || buffer.length === 0) return null;

    // Determinar nome do arquivo
    const mimetype = mediaMessage.mimetype as string;
    let filename = mediaMessage.fileName || "";
    if (!filename) {
        const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
        filename = `${Date.now()}.${ext}`;
    } else {
        const ext = filename.split(".").pop() || "";
        const name = filename
            .split(".")
            .slice(0, -1)
            .join(".")
            .replace(/\s/g, "_")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        filename = `${name.trim()}_${Date.now()}.${ext}`;
    }

    // Salvar no disco (mesma estrutura de verifyMediaMessage)
    const contactFolder = contactId ? `contact${contactId}` : `contact_sync_${Date.now()}`;
    const folder = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        `company${companyId}`,
        contactFolder
    );

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        try { fs.chmodSync(folder, 0o777); } catch { }
    }

    await writeFileAsync(
        path.join(folder, filename),
        buffer
    );

    const mediaUrl = `${contactFolder}/${filename}`;
    logger.debug(`[SyncMedia] Mídia salva: ${mediaUrl} (${buffer.length} bytes)`);

    return { mediaUrl, filename };
};

// Cache para throttling (evita sync repetido em curto período)
const lastSyncTime = new Map<string, number>();
const SYNC_THROTTLE_MS = 30 * 1000; // 30 segundos (reduzido de 5 minutos)

interface SyncChatHistoryParams {
    ticketId: string | number;
    companyId: number;
    messageCount?: number;
    forceSync?: boolean;
    // Novos parâmetros para sincronização completa
    syncAll?: boolean;  // Se true, busca todas as mensagens disponíveis
    maxPages?: number;  // Número máximo de páginas (50 mensagens por página)
}

interface SyncResult {
    synced: number;
    skipped: boolean;
    reason?: string;
}

/**
 * Sincroniza o histórico de mensagens de um chat do WhatsApp
 * usando fetchMessageHistory do Baileys (on-demand sync)
 */
const SyncChatHistoryService = async ({
    ticketId,
    companyId,
    messageCount = 100,  // Aumentado de 50 para 100
    forceSync = false,
    syncAll = false,     // Novo: sincronização completa
    maxPages = 5         // Novo: até 5 páginas (500 mensagens)
}: SyncChatHistoryParams): Promise<SyncResult> => {
    const io = getIO();
    try {
        // 1. Buscar ticket com informações necessárias
        const ticket = await Ticket.findByPk(ticketId, {
            include: [
                { model: Contact, as: "contact" },
                { model: Whatsapp, as: "whatsapp" }
            ]
        });

        if (!ticket) {
            return { synced: 0, skipped: true, reason: "Ticket não encontrado" };
        }

        if (!ticket.whatsapp) {
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não encontrada" };
        }

        // Verificar se sync está habilitado para esta conexão
        if (!ticket.whatsapp.syncOnTicketOpen && !forceSync) {
            return { synced: 0, skipped: true, reason: "Sync desabilitado para esta conexão" };
        }

        // Verificar canal suportado
        if (ticket.channel !== "whatsapp") {
            return { synced: 0, skipped: true, reason: "Canal não suportado para sync" };
        }

        // 2. Throttling - evita sync repetido em curto período
        const throttleKey = `${companyId}:${ticketId}`;
        const lastSync = lastSyncTime.get(throttleKey) || 0;
        const now = Date.now();

        if (!forceSync && now - lastSync < SYNC_THROTTLE_MS) {
            const remainingSec = Math.ceil((SYNC_THROTTLE_MS - (now - lastSync)) / 1000);
            return { synced: 0, skipped: true, reason: `Aguarde ${remainingSec}s para sincronizar novamente` };
        }

        // 3. Obter wbot da conexão
        let wbot: any;
        try {
            wbot = getWbot(ticket.whatsappId);
        } catch (err) {
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não inicializada" };
        }

        // 4. Montar JID do contato (com proteção contra PENDING_ e LIDs)
        let jid: string;
        if (ticket.isGroup) {
            jid = ticket.contact.remoteJid || `${ticket.contact.number}@g.us`;
        } else {
            const num = ticket.contact.number || "";
            if (num.startsWith("PENDING_") || num.includes("@lid")) {
                // Contato pendente — usar remoteJid se disponível (LID é válido para fetchMessageHistory)
                const rid = ticket.contact.remoteJid || (ticket.contact as any).lidJid;
                if (rid) {
                    jid = rid;
                } else {
                    return { synced: 0, skipped: true, reason: "Contato PENDING sem JID válido para sync" };
                }
            } else {
                jid = `${num}@s.whatsapp.net`;
            }
        }

        // 5. Buscar mensagem MAIS ANTIGA do banco para usar como âncora
        // (queremos buscar mensagens ANTERIORES a esta)
        const oldestMessage = await Message.findOne({
            where: { ticketId: ticket.id },
            order: [["createdAt", "ASC"]]
        });


        // 6. Preparar âncora para fetchMessageHistory
        let oldestKey: any = {
            remoteJid: jid,
            id: "",
            fromMe: true
        };
        let oldestTimestamp = Math.floor(Date.now() / 1000);

        if (oldestMessage && oldestMessage.dataJson) {
            try {
                const parsed = JSON.parse(oldestMessage.dataJson);
                if (parsed.key) {
                    oldestKey = parsed.key;
                    oldestTimestamp = Number(parsed.messageTimestamp) || oldestTimestamp;
                }
            } catch { }
        }

        // 7. Buscar histórico via API (fetchMessageHistory)
        // Substitui o uso de store.loadMessages que falha com Redis
        let messages: any[] = [];
        const wbotAny = wbot as any;

        if (typeof wbotAny.fetchMessageHistory === "function") {
            try {
                logger.info(`[SyncChatHistory] Buscando ${messageCount} mensagens via API para jid=${jid}...`);

                // Emitir progresso inicial
                io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-sync-progress`, {
                    progress: 0,
                    state: "FETCHING",
                    message: "Solicitando histórico ao WhatsApp..."
                });

                // Usar handler centralizado para receber mensagens
                const fetchId = registerFetchRequest(jid);
                const fetchPromise = startFetchRequest(fetchId, jid, 60000); // 60s timeout

                // Registrar handler temporário para este JID
                const tempHandler = (msgs: any[], event: any) => {
                    logger.debug(`[SyncChatHistory] Handler recebeu ${msgs.length} mensagens para jid=${jid}`);
                    messages.push(...msgs);
                };

                registerHistoryHandler(jid, tempHandler);

                try {
                    // Disparar o fetch
                    await wbotAny.fetchMessageHistory(messageCount, oldestKey, oldestTimestamp);

                    // Aguardar resultado
                    const result = await fetchPromise;
                    messages = result.messages;

                    logger.info(`[SyncChatHistory] Recebido ${messages.length} mensagens, isLatest=${result.isLatest}, progress=${result.progress}`);

                    // Emitir progresso final
                    io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-sync-progress`, {
                        progress: result.progress || 100,
                        state: "COMPLETED",
                        message: `${messages.length} mensagens sincronizadas`
                    });

                } catch (err: any) {
                    logger.warn(`[SyncChatHistory] Erro na API fetchMessageHistory: ${err}`);
                    
                    // Retry uma vez após 2s
                    try {
                        logger.info(`[SyncChatHistory] Tentando retry após 2s...`);
                        await new Promise(r => setTimeout(r, 2000));
                        
                        const retryPromise = startFetchRequest(fetchId, jid, 60000);
                        await wbotAny.fetchMessageHistory(messageCount, oldestKey, oldestTimestamp);
                        
                        const retryResult = await retryPromise;
                        messages = retryResult.messages;
                        
                        logger.info(`[SyncChatHistory] Retry bem-sucedido: ${messages.length} mensagens`);
                    } catch (retryErr: any) {
                        logger.warn(`[SyncChatHistory] Retry falhou: ${retryErr}`);
                    }
                } finally {
                    // Limpar handler
                    unregisterHistoryHandler(jid, tempHandler);
                    cancelFetchRequest(fetchId);
                }

            } catch (err: any) {
                logger.warn(`[SyncChatHistory] Erro ao buscar histórico: ${err?.message}`);
            }
        } else {
            // Fallback para chatModify se API não disponível (raro)
            try {
                await wbot.chatModify({ markRead: true }, jid);
            } catch { }
            return { synced: 0, skipped: true, reason: "API fetchMessageHistory não disponível" };
        }

        if (!messages || messages.length === 0) {
            lastSyncTime.set(throttleKey, now);
            logger.info(`[SyncChatHistory] Nenhuma mensagem recebida para ticketId=${ticketId} jid=${jid}`);

            // Tentar download retroativo de mídias pendentes (mensagens salvas sem mediaUrl)
            try {
                logger.info(`[SyncChatHistory] Iniciando downloadPendingMedia para ticketId=${ticketId}`);
                const retroCount = await downloadPendingMedia(ticket, wbot, companyId);
                if (retroCount > 0) {
                    logger.info(`[SyncChatHistory] Download retroativo: ${retroCount} mídias baixadas para ticketId=${ticketId}`);
                    return { synced: retroCount, skipped: false };
                } else {
                    logger.info(`[SyncChatHistory] Nenhuma mídia pendente para baixar no ticketId=${ticketId}`);
                }
            } catch (retroErr: any) {
                logger.warn(`[SyncChatHistory] Erro no download retroativo: ${retroErr?.message}`);
            }

            return { synced: 0, skipped: false, reason: "Nenhuma mensagem nova encontrada" };
        }

        // Log diagnóstico: estrutura das mensagens recebidas
        logger.info(`[SyncChatHistory] Recebidas ${messages.length} mensagens para processar`);
        for (let i = 0; i < Math.min(5, messages.length); i++) {
            const m = messages[i];
            const hasMsg = !!m?.message;
            const msgKeys = hasMsg ? Object.keys(m.message) : [];
            const body = hasMsg ? getBodyMessage(m) : null;
            logger.info(`[SyncChatHistory] Diag msg[${i}]: id=${m?.key?.id?.substring(0,12)} hasMessage=${hasMsg} types=[${msgKeys.join(',')}] body=${body ? body.substring(0, 50) : 'NULL'} ts=${m?.messageTimestamp}`);
        }

        // =====================================================================
        // SINCRONIZAÇÃO COM MÚLTIPLAS PÁGINAS (se syncAll=true)
        // =====================================================================
        let allMessages = [...messages];
        
        if (syncAll && messages.length >= messageCount) {
            let currentPage = 1;
            let oldestKeyInBatch = messages.length > 0 ? messages[messages.length - 1].key : oldestKey;
            let oldestTimestampInBatch = messages.length > 0 
                ? Number(messages[messages.length - 1].messageTimestamp) || Math.floor(Date.now() / 1000)
                : oldestTimestamp;

            while (currentPage < maxPages) {
                try {
                    // Emitir progresso de paginação
                    io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-sync-progress`, {
                        progress: Math.round((currentPage / maxPages) * 100),
                        state: "PAGINATING",
                        message: `Buscando página ${currentPage + 1} de ${maxPages}...`
                    });

                    const fetchId = registerFetchRequest(jid);
                    const fetchPromise = startFetchRequest(fetchId, jid, 60000);
                    
                    const tempHandler = (msgs: any[]) => {
                        batchMessages.push(...msgs);
                    };
                    
                    let batchMessages: any[] = [];
                    registerHistoryHandler(jid, tempHandler);

                    try {
                        await wbotAny.fetchMessageHistory(messageCount, oldestKeyInBatch, oldestTimestampInBatch);
                        
                        const result = await fetchPromise;
                        batchMessages = result.messages;
                        
                        if (!batchMessages || batchMessages.length === 0) break;
                        
                        allMessages = [...allMessages, ...batchMessages];
                        currentPage++;
                        
                        // Atualizar âncora para próxima página
                        oldestKeyInBatch = batchMessages[batchMessages.length - 1].key;
                        oldestTimestampInBatch = Number(batchMessages[batchMessages.length - 1].messageTimestamp);
                        
                        // Parar se recebeu menos que o esperado (fim do histórico)
                        if (batchMessages.length < messageCount) break;
                        
                    } catch (batchErr: any) {
                        logger.warn(`[SyncChatHistory] Erro na página ${currentPage}: ${batchErr?.message}`);
                        break;
                    } finally {
                        unregisterHistoryHandler(jid, tempHandler);
                        cancelFetchRequest(fetchId);
                    }
                    
                } catch (batchErr: any) {
                    logger.warn(`[SyncChatHistory] Erro na página ${currentPage}: ${batchErr?.message}`);
                    break;
                }
            }
            
            logger.info(`[SyncChatHistory] Total de mensagens buscadas: ${allMessages.length} (${currentPage} páginas)`);
        }
        // =====================================================================

        // 7. Processar e salvar mensagens novas
        let syncedCount = 0;

        // Filtrar mensagens válidas (remover undefined/null que podem vir do Baileys)
        const validMessages = allMessages.filter(m => m && m.key && m.key.id);

        for (const msg of validMessages) {
            try {
                // Validar estrutura básica da mensagem (redundância, mas seguro)
                if (!msg || !msg.key || !msg.key.id) {
                    const debugMsg = JSON.stringify(msg, (key, value) => {
                        if (key === 'auth') return undefined; // Ocultar dados sensíveis se houver
                        return value;
                    }, 2); // Indentação para leitura
                    logger.warn(`[SyncChatHistory] Mensagem com estrutura inválida, pulando. Dump completo -> ${debugMsg?.substring(0, 1000)}`);
                    continue;
                }

                // Verificar se mensagem já existe no banco
                const existingMsg = await Message.findOne({
                    where: { wid: msg.key.id, companyId }
                });

                if (existingMsg) {
                    continue; // Já existe, pular
                }

                // Validar mensagem
                if (!isValidMsg(msg)) {
                    logger.debug(`[SyncChatHistory] Mensagem ${msg.key.id} rejeitada por isValidMsg`);
                    continue;
                }

                // Verificar se msg.message existe (não é placeholder)
                if (!msg.message) {
                    logger.debug(`[SyncChatHistory] Mensagem ${msg.key.id} é placeholder (sem .message), pulando`);
                    continue;
                }

                // Extrair tipo da mensagem
                const messageType = getTypeMessage(msg);

                // Pular tipos de mensagem que não devem ser exibidos como balões
                const skipTypes = ["protocolMessage", "senderKeyDistributionMessage"];
                if (skipTypes.includes(messageType)) {
                    continue;
                }

                const messageBody = getBodyMessage(msg) || "";

                // Mapear tipo Baileys → tipo frontend (o frontend espera image/video/audio, não imageMessage/videoMessage/audioMessage)
                const mediaTypeMap: Record<string, string> = {
                    imageMessage: "image",
                    videoMessage: "video",
                    audioMessage: "audio",
                    ptvMessage: "video",
                    documentMessage: "document",
                    documentWithCaptionMessage: "document",
                    stickerMessage: "sticker",
                    contactMessage: "contactMessage",
                    contactsArrayMessage: "contactMessage",
                    locationMessage: "locationMessage",
                    liveLocationMessage: "locationMessage",
                    reactionMessage: "reactionMessage",
                    protocolMessage: "protocolMessage",
                    ephemeralMessage: "ephemeralMessage",
                };
                const finalMediaType = mediaTypeMap[messageType] || messageType;

                // Log de diagnóstico para mensagens sem body
                if (!messageBody && !["sticker", "audio", "image", "video", "document"].includes(finalMediaType)) {
                    logger.warn(`[SyncChatHistory] Mensagem ${msg.key.id} sem body: type=${messageType} -> ${finalMediaType} msgKeys=[${Object.keys(msg.message || {}).join(',')}]`);
                }

                // Validar timestamp
                const timestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'object' && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : Number(msg.messageTimestamp))
                    : Math.floor(Date.now() / 1000);

                // Tentar baixar mídia se for tipo suportado
                let mediaUrl: string | null = null;
                if (DOWNLOADABLE_MEDIA_TYPES.includes(finalMediaType)) {
                    try {
                        const downloaded = await downloadSyncMedia(msg, wbot, companyId, ticket.contactId);
                        if (downloaded) {
                            mediaUrl = downloaded.mediaUrl;
                            // Atualizar body se documento sem caption
                            if (!messageBody && downloaded.filename) {
                                // Manter body vazio — o frontend mostra o arquivo
                            }
                        }
                    } catch (dlErr: any) {
                        logger.debug(`[SyncChatHistory] Falha no download da mídia ${msg.key.id}: ${dlErr?.message}`);
                        // Continua sem mídia — placeholder será exibido no frontend
                    }
                }

                const messageData = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: ticket.contactId,
                    body: messageBody,
                    fromMe: msg.key.fromMe || false,
                    mediaType: finalMediaType,
                    mediaUrl,
                    read: true,
                    ack: msg.status || 0,
                    remoteJid: msg.key.remoteJid || ticket.contact?.remoteJid,
                    participant: msg.key.participant || null,
                    dataJson: JSON.stringify(msg),
                    createdAt: new Date(timestamp * 1000),
                    updatedAt: new Date(),
                    companyId
                };

                await CreateMessageService({ messageData, companyId });
                syncedCount++;
            } catch (err: any) {
                logger.warn(`[SyncChatHistory] Erro ao salvar mensagem: ${err?.message}`);
            }
        }

        // 8. Atualizar throttle timestamp
        lastSyncTime.set(throttleKey, now);

        // 9. Emitir evento para atualizar UI
        if (syncedCount > 0) {
            io.of(`/workspace-${companyId}`)
                .emit(`company-${companyId}-ticket`, {
                    action: "update",
                    ticket
                });

            logger.info(`[SyncChatHistory] Sincronizadas ${syncedCount} mensagens para ticketId=${ticketId}`);
        }

        // 10. Download retroativo de mídias pendentes (mensagens já salvas sem mediaUrl)
        if (forceSync) {
            try {
                const retroCount = await downloadPendingMedia(ticket, wbot, companyId);
                if (retroCount > 0) {
                    syncedCount += retroCount;
                    logger.info(`[SyncChatHistory] Download retroativo: ${retroCount} mídias baixadas para ticketId=${ticketId}`);
                }
            } catch (retroErr: any) {
                logger.warn(`[SyncChatHistory] Erro no download retroativo: ${retroErr?.message}`);
            }
        }

        return { synced: syncedCount, skipped: false };

    } catch (err: any) {
        logger.error(`[SyncChatHistory] Erro geral: ${err?.message}`);
        return { synced: 0, skipped: true, reason: `Erro: ${err?.message}` };
    }
};

/**
 * Busca mensagens de mídia já salvas no banco sem mediaUrl e tenta baixar
 * usando o dataJson salvo + downloadMediaMessage do Baileys.
 */
const downloadPendingMedia = async (
    ticket: Ticket,
    wbot: any,
    companyId: number
): Promise<number> => {
    // Buscar mensagens de mídia sem mediaUrl para este ticket
    const pendingMessages = await Message.findAll({
        where: {
            ticketId: ticket.id,
            mediaType: { [Op.in]: DOWNLOADABLE_MEDIA_TYPES },
            [Op.or]: [
                { mediaUrl: null },
                { mediaUrl: "" }
            ],
            dataJson: { [Op.not]: null }
        },
        order: [["createdAt", "DESC"]],
        limit: 50 // Limitar para não sobrecarregar
    });

    if (pendingMessages.length === 0) return 0;

    logger.info(`[DownloadPendingMedia] ${pendingMessages.length} mídias pendentes para ticketId=${ticket.id}`);

    let downloadedCount = 0;

    for (const dbMsg of pendingMessages) {
        try {
            // Parsear o dataJson para reconstruir a mensagem original do Baileys
            const originalMsg = JSON.parse(dbMsg.dataJson);
            if (!originalMsg?.message) continue;

            // Tentar download
            const result = await downloadSyncMedia(originalMsg, wbot, companyId, ticket.contactId);
            if (result) {
                // Atualizar mensagem no banco com a mediaUrl
                await dbMsg.update({ mediaUrl: result.mediaUrl });
                downloadedCount++;
                logger.debug(`[DownloadPendingMedia] Mídia baixada: msgId=${dbMsg.id} -> ${result.mediaUrl}`);
            }
        } catch (err: any) {
            // Silencioso: mídia pode estar expirada
            logger.debug(`[DownloadPendingMedia] Falha msgId=${dbMsg.id}: ${err?.message}`);
        }
    }

    return downloadedCount;
};

export default SyncChatHistoryService;
