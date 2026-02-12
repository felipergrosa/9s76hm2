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
 */
const isImportableMessage = (msg: proto.IWebMessageInfo): boolean => {
    if (!msg?.message) return false;
    if (msg.key?.remoteJid === "status@broadcast") return false;
    const msgType = getMessageType(msg);
    if (!msgType) return false;
    const validTypes = [
        "conversation", "extendedTextMessage",
        "imageMessage", "videoMessage", "audioMessage", "voiceMessage",
        "documentMessage", "stickerMessage", "ptvMessage",
        "contactMessage", "contactsArrayMessage", "locationMessage",
        "liveLocationMessage", "viewOnceMessage", "viewOnceMessageV2",
        "documentWithCaptionMessage", "ephemeralMessage"
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
 * Importa histórico de mensagens de um contato do WhatsApp
 * usando fetchMessageHistory do Baileys em batches iterativos.
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
        logger.info(`[ImportHistory] Emitindo progresso: ${current}/${total} - ${state} - ${date || ''}`);
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
        // 4. Montar JID do contato
        let jid = ticket.contact.number;
        if (ticket.isGroup) {
            jid = jid.includes("@g.us") ? jid : `${jid}@g.us`;
        } else {
            jid = jid.includes("@s.whatsapp.net") ? jid : `${jid}@s.whatsapp.net`;
        }

        // 5. Emitir estado "FETCHING" (em vez de PREPARING apenas)
        emitProgress(0, -1, "FETCHING", "Iniciando busca no dispositivo...");

        // 6. Verificar se store está disponível para importação
        if (!wbot.store || typeof wbot.store.loadMessages !== "function") {
            emitProgress(0, 0, "COMPLETED");
            return { synced: 0, skipped: true, reason: "Store não disponível nesta versão do Baileys" };
        }

        /**
         * Helper: Força sincronização completa usando chatModify
         * Isso força o WhatsApp Web a buscar mensagens mais antigas
         */
        const forceSyncViaChatModify = async (wbotInstance: any, targetJid: string): Promise<void> => {
            try {
                logger.info(`[ImportHistory] Forçando sincronização via chatModify para jid=${targetJid}`);

                // Marcar como não lido para forçar sync
                await wbotInstance.chatModify({
                    markRead: false,
                    archive: false,
                    lastMessages: []
                }, targetJid);

                // Esperar um pouco para o WhatsApp processar
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Marcar como lido novamente
                await wbotInstance.chatModify({
                    markRead: true,
                    lastMessages: []
                }, targetJid);

                logger.info(`[ImportHistory] Sync via chatModify concluído`);
            } catch (err: any) {
                logger.warn(`[ImportHistory] Erro ao forçar sync via chatModify: ${err?.message}`);
            }
        };

        /**
         * Helper: Usa loadMessages do store do Baileys (método mais confiável)
         * loadMessages carrega mensagens do cache local do WhatsApp Web
         */
        const fetchMessagesViaStore = async (
            wbotInstance: any,
            targetJid: string,
            count: number,
            cursor?: any
        ): Promise<any[]> => {
            try {
                // Verificar se store está disponível
                if (!wbotInstance.store || typeof wbotInstance.store.loadMessages !== 'function') {
                    logger.warn(`[ImportHistory] Store ou loadMessages não disponível`);
                    return [];
                }

                logger.info(`[ImportHistory] Carregando ${count} mensagens do store para jid=${targetJid}, cursor=${cursor ? 'SIM' : 'NÃO'}`);

                // loadMessages do store é síncrono e mais confiável
                const messages = await wbotInstance.store.loadMessages(
                    targetJid,
                    count,
                    cursor, // cursor - undefined para pegar as mais recentes, ou key da mensagem mais antiga
                    undefined // sock - undefined para store local
                );

                logger.info(`[ImportHistory] loadMessages retornou ${messages.length} mensagens`);
                return messages || [];
            } catch (err: any) {
                logger.error(`[ImportHistory] Erro ao usar loadMessages: ${err?.message}`);
                return [];
            }
        };

        const BATCH_SIZE = 50;
        let allMessages: any[] = [];
        let cursor: any = undefined;
        let keepFetching = true;
        let fetchAttempts = 0;
        const MAX_FETCH_ATTEMPTS = 50; // Aumentado para buscar mais fundo se necessário

        // Tentar encontrar o cursor inicial baseado na mensagem mais antiga do banco
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

        logger.info(`[ImportHistory] Iniciando busca iterativa para ticketId=${ticketId}, jid=${jid}`);

        // Forçar sincronização via chatModify antes de começar
        await forceSyncViaChatModify(wbot, jid);

        while (keepFetching && fetchAttempts < MAX_FETCH_ATTEMPTS) {
            fetchAttempts++;
            try {
                // Busca via store (mais rápido)
                const messages = await fetchMessagesViaStore(wbot, jid, BATCH_SIZE, cursor);

                if (!messages || messages.length === 0) {
                    // Se o store falhar em trazer mais e ainda tivermos tentativas, 
                    // podemos tentar um pequeno delay ou forçar chatModify de novo (throttle)
                    if (fetchAttempts < 3) {
                        logger.info(`[ImportHistory] Store vazio na tentativa ${fetchAttempts}, aguardando sync...`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    keepFetching = false;
                    break;
                }

                // Filtrar e processar
                const validBatch = messages.filter(m => {
                    if (!m?.key?.id) return false;
                    if (cutoffTimestamp) {
                        const msgTs = Number(m.messageTimestamp || 0);
                        if (msgTs < cutoffTimestamp) return false;
                    }
                    return true;
                });

                allMessages.push(...validBatch);

                // Atualizar cursor para próxima página
                const oldestInBatch = messages[messages.length - 1];
                if (oldestInBatch?.key) {
                    cursor = oldestInBatch.key;
                }

                // Emitir progresso de busca (total = -1 indica que ainda estamos contando)
                emitProgress(allMessages.length, -1, "FETCHING", `Localizadas ${allMessages.length} mensagens...`);

                // Se trouxe menos que o batch, parou de encontrar no cache
                if (messages.length < BATCH_SIZE) {
                    keepFetching = false;
                    break;
                }

                // Verificar se a última mensagem do batch já passou do corte
                if (cutoffTimestamp) {
                    const lastTs = Number(oldestInBatch.messageTimestamp || 0);
                    if (lastTs < cutoffTimestamp) {
                        keepFetching = false;
                        break;
                    }
                }

                // Pequeno delay para permitir processamento de outros eventos de socket
                await new Promise(r => setTimeout(r, 500));
            } catch (err: any) {
                logger.warn(`[ImportHistory] Erro na busca batch ${fetchAttempts}: ${err?.message}`);
                keepFetching = false;
            }
        }


        if (allMessages.length === 0) {
            emitProgress(0, 0, "COMPLETED");
            return { synced: 0, skipped: false, reason: "Nenhuma mensagem encontrada no período" };
        }

        // 7. Processar e salvar mensagens
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
                    logger.debug(`[ImportHistory] Msg duplicada encontrada (pular): wid=${msg.key.id}`);
                    continue;
                } else {
                    logger.debug(`[ImportHistory] Msg nova (persistir): wid=${msg.key.id}`);
                }

                // Validar mensagem
                if (!isImportableMessage(msg)) {
                    logger.debug(`[ImportHistory] Msg não importável: ${getMessageType(msg)}`);
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
                                msg.message?.viewOnceMessage?.message?.videoMessage;

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
