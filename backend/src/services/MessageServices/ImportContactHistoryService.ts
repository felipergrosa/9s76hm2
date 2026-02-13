import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import CreateMessageService from "./CreateMessageService";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import { downloadMediaMessage, proto } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);

/**
 * Extrai o tipo da mensagem (inline para evitar dependência de export)
 */
const getMessageType = (msg: proto.IWebMessageInfo): string => {
    const types = Object.keys(msg.message || {});
    const filtered = types.filter(t =>
        t !== "messageContextInfo" &&
        t !== "senderKeyDistributionMessage"
    );
    return filtered[0] || "";
};

/**
 * Verifica se a mensagem é válida para importação
 * Aceita TODOS os tipos relevantes: texto, mídia, stickers, reações, contatos, localização etc.
 */
const isImportableMessage = (msg: proto.IWebMessageInfo): boolean => {
    if (!msg?.message) return false;
    if (msg.key?.remoteJid === "status@broadcast") return false;
    const msgType = getMessageType(msg);
    if (!msgType) return false;
    const validTypes = [
        // Texto
        "conversation", "extendedTextMessage",
        // Mídia
        "imageMessage", "videoMessage", "audioMessage", "voiceMessage",
        "documentMessage", "stickerMessage", "ptvMessage",
        // Contatos e localização
        "contactMessage", "contactsArrayMessage", "locationMessage",
        "liveLocationMessage",
        // ViewOnce
        "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
        // Documentos com legenda
        "documentWithCaptionMessage",
        // Efêmeras
        "ephemeralMessage",
        // Reações
        "reactionMessage",
        // Enquetes
        "pollCreationMessage", "pollCreationMessageV2", "pollCreationMessageV3", "pollUpdateMessage",
        // Botões e listas (templates)
        "buttonsMessage", "buttonsResponseMessage",
        "listMessage", "listResponseMessage",
        "templateMessage", "templateButtonReplyMessage",
        // Protocolo de mensagem editada
        "editedMessage", "protocolMessage",
        // Pedidos e pagamentos
        "orderMessage", "paymentInviteMessage",
        // Produtos
        "productMessage",
        // Mensagem com caption
        "imageWithCaptionMessage",
        // Newsletter/channel
        "newsletterAdminInviteMessage",
    ];
    return validTypes.includes(msgType);
};

interface ImportContactHistoryParams {
    ticketId: string | number;
    companyId: number;
    periodMonths: number; // 0 = completo, 1, 3, 6
}

interface ImportResult {
    synced: number;
    skipped: boolean;
    reason?: string;
}

/**
 * Importa histórico de mensagens de um contato do WhatsApp.
 * 
 * Fase 1: Busca mensagens do cache local do Baileys (store.loadMessages)
 * Fase 2: Solicita mensagens mais antigas ao servidor do WhatsApp (fetchMessageHistory)
 *         capturando-as via evento messaging-history.set
 * 
 * Emite progresso via Socket.IO no canal importHistory-{ticketId}.
 */
const ImportContactHistoryService = async ({
    ticketId,
    companyId,
    periodMonths
}: ImportContactHistoryParams): Promise<ImportResult> => {
    const io = getIO();
    const eventName = `importHistory-${ticketId}`;
    const namespace = `/workspace-${companyId}`;

    logger.info(`[ImportHistory] Iniciando importação - ticketId: ${ticketId}, companyId: ${companyId}, periodMonths: ${periodMonths}`);

    const emitProgress = (current: number, total: number, state: string, date?: string) => {
        logger.info(`[ImportHistory] Progresso: ${current}/${total} - ${state} - ${date || ''}`);
        io.of(namespace).emit(eventName, {
            action: "update",
            status: { this: current, all: total, state, date }
        });
    };

    try {
        // 1. Buscar ticket com informações necessárias
        const ticket = await Ticket.findByPk(ticketId, {
            include: [
                { model: Contact, as: "contact" },
                { model: Whatsapp, as: "whatsapp" }
            ]
        });

        if (!ticket) {
            logger.error(`[ImportHistory] Ticket não encontrado: ${ticketId}`);
            return { synced: 0, skipped: true, reason: "Ticket não encontrado" };
        }

        if (!ticket.whatsapp) {
            logger.error(`[ImportHistory] Conexão WhatsApp não encontrada para ticket: ${ticketId}`);
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não encontrada" };
        }

        if (ticket.channel !== "whatsapp") {
            logger.error(`[ImportHistory] Canal não suportado: ${ticket.channel} para ticket: ${ticketId}`);
            return { synced: 0, skipped: true, reason: "Canal não suportado para importação" };
        }

        // 2. Obter wbot da conexão
        let wbot: any;
        try {
            wbot = getWbot(ticket.whatsappId);
            logger.info(`[ImportHistory] Wbot obtido com sucesso para whatsappId: ${ticket.whatsappId}`);
        } catch (err) {
            logger.error(`[ImportHistory] Erro ao obter wbot: ${err.message}`);
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não inicializada" };
        }

        // 3. Calcular data de corte
        let cutoffTimestamp: number | null = null;
        if (periodMonths > 0) {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
            cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);
        }

        // 4. Montar JID do contato
        let jid = ticket.contact.number;
        if (ticket.isGroup) {
            jid = jid.includes("@g.us") ? jid : `${jid}@g.us`;
        } else {
            jid = jid.includes("@s.whatsapp.net") ? jid : `${jid}@s.whatsapp.net`;
        }

        // 5. Emitir estado "FETCHING"
        emitProgress(0, -1, "FETCHING", "Iniciando busca no dispositivo...");

        // ============================================================
        //  FASE 1 — Cache local (store.loadMessages)
        // ============================================================
        let allMessages: any[] = [];

        if (wbot.store && typeof wbot.store.loadMessages === "function") {
            logger.info(`[ImportHistory] Fase 1 — Buscando mensagens do cache local para jid=${jid}`);

            const BATCH_SIZE = 50;
            let cursor: any = undefined;
            let keepFetching = true;
            let fetchAttempts = 0;
            const MAX_FETCH_ATTEMPTS = 100;

            // Cursor inicial baseado na mensagem mais antiga do banco
            const oldestMessageInDB = await Message.findOne({
                where: { ticketId: ticket.id },
                order: [["createdAt", "ASC"]]
            });

            if (oldestMessageInDB?.dataJson) {
                try {
                    const parsed = JSON.parse(oldestMessageInDB.dataJson);
                    cursor = parsed?.key;
                } catch { }
            }

            while (keepFetching && fetchAttempts < MAX_FETCH_ATTEMPTS) {
                fetchAttempts++;
                try {
                    const messages = await wbot.store.loadMessages(jid, BATCH_SIZE, cursor, undefined);

                    if (!messages || messages.length === 0) {
                        if (fetchAttempts < 3) {
                            await new Promise(r => setTimeout(r, 2000));
                            continue;
                        }
                        break;
                    }

                    const validBatch = messages.filter(m => {
                        if (!m?.key?.id) return false;
                        if (cutoffTimestamp) {
                            const msgTs = Number(m.messageTimestamp || 0);
                            if (msgTs < cutoffTimestamp) return false;
                        }
                        return true;
                    });

                    allMessages.push(...validBatch);

                    const oldestInBatch = messages[messages.length - 1];
                    if (oldestInBatch?.key) {
                        cursor = oldestInBatch.key;
                    }

                    emitProgress(allMessages.length, -1, "FETCHING", `Fase 1: ${allMessages.length} mensagens do cache...`);

                    if (messages.length < BATCH_SIZE) break;

                    if (cutoffTimestamp) {
                        const lastTs = Number(oldestInBatch.messageTimestamp || 0);
                        if (lastTs < cutoffTimestamp) break;
                    }

                    await new Promise(r => setTimeout(r, 200));
                } catch (err: any) {
                    logger.warn(`[ImportHistory] Fase 1 — Erro batch ${fetchAttempts}: ${err?.message}`);
                    break;
                }
            }

            logger.info(`[ImportHistory] Fase 1 concluída: ${allMessages.length} mensagens do cache local`);
        } else {
            logger.warn(`[ImportHistory] store.loadMessages não disponível, pulando Fase 1`);
        }

        // ============================================================
        //  FASE 2 — History Sync via reconexão do WebSocket
        //  Força reconexão para que o WhatsApp envie sync automático,
        //  capturando mensagens do JID alvo via messaging-history.set
        // ============================================================
        logger.info(`[ImportHistory] Fase 2 — Iniciando history sync via reconexão para jid=${jid}`);
        emitProgress(allMessages.length, -1, "FETCHING", "Fase 2: Reconectando para sincronizar histórico...");

        let totalFromServer = 0;
        const SYNC_TIMEOUT_MS = 120_000; // 120s para aguardar reconexão + sync

        try {
            // 1. Registrar handler temporário ANTES de fechar o websocket
            const capturedMessages: any[] = [];
            let resolveCapture: () => void;
            let syncEventsReceived = 0;

            const capturePromise = new Promise<void>((resolve) => {
                resolveCapture = resolve;
                setTimeout(() => resolve(), SYNC_TIMEOUT_MS);
            });

            // Handler que captura TODAS as mensagens do JID alvo durante o sync
            const historyHandler = (messageSet: any) => {
                try {
                    syncEventsReceived++;
                    const messages = messageSet?.messages || [];
                    logger.info(`[ImportHistory] Fase 2 — messaging-history.set #${syncEventsReceived}: ${messages.length} mensagens recebidas`);

                    // Filtrar mensagens do JID alvo
                    const targetMessages = messages.filter((m: any) => {
                        if (!m?.key) return false;
                        return m.key.remoteJid === jid;
                    });

                    if (targetMessages.length > 0) {
                        capturedMessages.push(...targetMessages);
                        logger.info(`[ImportHistory] Fase 2 — +${targetMessages.length} mensagens do JID alvo (total acumulado: ${capturedMessages.length})`);
                        emitProgress(allMessages.length + capturedMessages.length, -1, "FETCHING", `Fase 2: +${capturedMessages.length} do sync...`);
                    }
                } catch (err: any) {
                    logger.warn(`[ImportHistory] Fase 2 — Erro no handler de sync: ${err?.message}`);
                }
            };

            // Handler para detectar quando o sync terminou
            // O isLatest=true indica a última batch de sync
            const syncCompleteHandler = (messageSet: any) => {
                try {
                    if (messageSet?.isLatest) {
                        logger.info(`[ImportHistory] Fase 2 — Sync completo detectado (isLatest=true). Total capturadas: ${capturedMessages.length}`);
                        // Aguardar mais 5s para batches restantes antes de resolver
                        setTimeout(() => resolveCapture(), 5000);
                    }
                } catch { }
            };

            // 2. Registrar handlers no wbot
            wbot.ev.on("messaging-history.set", historyHandler);
            wbot.ev.on("messaging-history.set", syncCompleteHandler);

            // 3. Monitorar reconexão
            let reconnected = false;
            const connectionHandler = (update: any) => {
                if (update?.connection === "open") {
                    reconnected = true;
                    logger.info(`[ImportHistory] Fase 2 — Sessão reconectou com sucesso`);
                    emitProgress(allMessages.length, -1, "FETCHING", "Fase 2: Reconectado — aguardando sync do WhatsApp...");
                }
            };
            wbot.ev.on("connection.update", connectionHandler);

            // 4. Fechar WebSocket (reconexão automática do Baileys)
            logger.info(`[ImportHistory] Fase 2 — Fechando WebSocket para forçar reconexão...`);
            wbot.ws.close();

            // 5. Aguardar sync completar ou timeout
            await capturePromise;

            // 6. Limpar handlers
            wbot.ev.off("messaging-history.set", historyHandler);
            wbot.ev.off("messaging-history.set", syncCompleteHandler);
            wbot.ev.off("connection.update", connectionHandler);

            // 7. Processar mensagens capturadas
            if (capturedMessages.length > 0) {
                // Filtrar por período
                const validMessages = capturedMessages.filter((m: any) => {
                    if (!m?.key?.id) return false;
                    if (cutoffTimestamp) {
                        const msgTs = Number(
                            typeof m.messageTimestamp === "object" && m.messageTimestamp?.low
                                ? m.messageTimestamp.low
                                : m.messageTimestamp || 0
                        );
                        if (msgTs < cutoffTimestamp) return false;
                    }
                    return true;
                });

                allMessages.push(...validMessages);
                totalFromServer = validMessages.length;
                logger.info(`[ImportHistory] Fase 2 concluída: ${totalFromServer} mensagens do sync (${syncEventsReceived} eventos, ${capturedMessages.length} raw)`);
            } else {
                logger.warn(`[ImportHistory] Fase 2 concluída: 0 mensagens recebidas (${syncEventsReceived} eventos, reconectou: ${reconnected})`);
                if (!reconnected) {
                    logger.error(`[ImportHistory] Fase 2 — Sessão NÃO reconectou. Verifique o status da conexão WhatsApp.`);
                }
            }
        } catch (syncErr: any) {
            logger.error(`[ImportHistory] Fase 2 — Erro no history sync: ${syncErr?.message}`);
        }

        // ============================================================
        //  DEDUPLICAÇÃO
        // ============================================================
        // Remover mensagens duplicadas pelo key.id
        const seenIds = new Set<string>();
        const uniqueMessages: any[] = [];
        for (const msg of allMessages) {
            const id = msg?.key?.id;
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                uniqueMessages.push(msg);
            }
        }
        allMessages = uniqueMessages;

        logger.info(`[ImportHistory] Total após dedup: ${allMessages.length} mensagens`);

        if (allMessages.length === 0) {
            emitProgress(0, 0, "COMPLETED");
            return { synced: 0, skipped: false, reason: "Nenhuma mensagem encontrada no período" };
        }

        // ============================================================
        //  PROCESSAMENTO E IMPORTAÇÃO
        // ============================================================
        const totalToProcess = allMessages.length;
        let syncedCount = 0;
        let processedCount = 0;

        emitProgress(0, totalToProcess, "IMPORTING");

        for (const msg of allMessages) {
            processedCount++;

            try {
                if (!msg || !msg.key || !msg.key.id) continue;

                // Verificar se já existe no banco
                const existingMsg = await Message.findOne({
                    where: { wid: msg.key.id, companyId }
                });

                if (existingMsg) {
                    continue;
                }

                // Validar mensagem
                if (!isImportableMessage(msg)) {
                    continue;
                }

                // Extrair dados da mensagem
                const messageType = getMessageType(msg);
                const messageBody = getBodyMessage(msg) || "";

                // Validar timestamp
                const timestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === "object" && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : Number(msg.messageTimestamp))
                    : Math.floor(Date.now() / 1000);

                // Determinar se é mídia
                const isMediaType = [
                    "imageMessage", "videoMessage", "audioMessage", "voiceMessage",
                    "documentMessage", "stickerMessage", "documentWithCaptionMessage",
                    "ptvMessage"
                ].includes(messageType);

                let mediaUrl: string | null = null;
                let mediaType = messageType;

                // Tentar baixar mídia se for mensagem de mídia
                if (isMediaType) {
                    try {
                        let buffer: Buffer | null = null;
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
                        } catch (downloadErr: any) {
                            logger.warn(`[ImportHistory] Falha download mídia msg ${msg.key.id}: ${downloadErr?.message}`);
                        }

                        if (buffer) {
                            // Determinar mimetype e filename
                            const mineType =
                                msg.message?.imageMessage ||
                                msg.message?.audioMessage ||
                                msg.message?.videoMessage ||
                                msg.message?.stickerMessage ||
                                msg.message?.documentMessage ||
                                msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
                                msg.message?.ephemeralMessage?.message?.audioMessage ||
                                msg.message?.ephemeralMessage?.message?.documentMessage ||
                                msg.message?.ephemeralMessage?.message?.videoMessage ||
                                msg.message?.ephemeralMessage?.message?.imageMessage ||
                                msg.message?.viewOnceMessage?.message?.imageMessage ||
                                msg.message?.viewOnceMessage?.message?.videoMessage ||
                                msg.message?.ptvMessage;

                            if (mineType?.mimetype) {
                                let filename = msg.message?.documentMessage?.fileName || "";
                                if (!filename) {
                                    const ext = mineType.mimetype.split("/")[1].split(";")[0];
                                    filename = `${new Date().getTime()}_${msg.key.id.slice(-6)}.${ext}`;
                                } else {
                                    filename = `${new Date().getTime()}_${filename}`;
                                }

                                // Salvar arquivo
                                const contactFolder = `contact${ticket.contactId}`;
                                const folder = path.resolve(
                                    __dirname, "..", "..", "..", "public",
                                    `company${companyId}`, contactFolder
                                );

                                if (!fs.existsSync(folder)) {
                                    fs.mkdirSync(folder, { recursive: true });
                                    fs.chmodSync(folder, 0o777);
                                }

                                await writeFileAsync(
                                    path.join(folder, filename),
                                    buffer.toString("base64"),
                                    "base64"
                                );

                                mediaUrl = `${contactFolder}/${filename}`;

                                // Determinar mediaType final
                                const mimeBase = mineType.mimetype.split("/")[0];
                                if (messageType === "stickerMessage" || mineType.mimetype === "image/webp") {
                                    mediaType = "sticker";
                                } else {
                                    mediaType = mimeBase;
                                }
                            }
                        }
                    } catch (mediaErr: any) {
                        logger.warn(`[ImportHistory] Erro processando mídia: ${mediaErr?.message}`);
                    }
                }

                const messageData: any = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: msg.key.fromMe ? undefined : ticket.contactId,
                    body: messageBody || (mediaUrl ? "Mídia" : ""),
                    fromMe: msg.key.fromMe || false,
                    mediaType: mediaUrl ? mediaType : messageType,
                    mediaUrl,
                    read: true,
                    ack: msg.status || 0,
                    remoteJid: msg.key.remoteJid || ticket.contact?.remoteJid,
                    participant: msg.key.participant || null,
                    dataJson: JSON.stringify(msg),
                    ticketImported: true,
                    createdAt: new Date(timestamp * 1000),
                    updatedAt: new Date(),
                    companyId
                };

                await CreateMessageService({ messageData, companyId });
                syncedCount++;
            } catch (msgErr: any) {
                logger.warn(`[ImportHistory] Erro ao salvar mensagem ${processedCount}: ${msgErr?.message}`);
            }

            // Emitir progresso a cada 5 mensagens ou na última
            if (processedCount % 5 === 0 || processedCount === totalToProcess) {
                const msgTs = msg.messageTimestamp
                    ? Number(typeof msg.messageTimestamp === "object" && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : msg.messageTimestamp) * 1000
                    : Date.now();

                emitProgress(
                    processedCount,
                    totalToProcess,
                    "IMPORTING",
                    new Date(msgTs).toLocaleDateString("pt-BR")
                );
            }

            // Throttle mínimo entre processamento para não travar
            if (processedCount % 20 === 0) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // 8. Emitir "COMPLETED"
        emitProgress(totalToProcess, totalToProcess, "COMPLETED");

        // 9. Emitir refresh do ticket para atualizar UI
        if (syncedCount > 0) {
            io.of(namespace).emit(`company-${companyId}-ticket`, {
                action: "update",
                ticket
            });
        }

        logger.info(`[ImportHistory] Concluído: ${syncedCount} mensagens importadas para ticketId=${ticketId}`);

        // Auto-fechar progresso após 3s
        setTimeout(() => {
            io.of(namespace).emit(eventName, { action: "refresh" });
        }, 3000);

        return { synced: syncedCount, skipped: false };

    } catch (err: any) {
        logger.error(`[ImportHistory] Erro geral: ${err?.message}`);
        emitProgress(0, 0, "COMPLETED", "Erro na importação");
        return { synced: 0, skipped: true, reason: `Erro: ${err?.message}` };
    }
};

export default ImportContactHistoryService;
