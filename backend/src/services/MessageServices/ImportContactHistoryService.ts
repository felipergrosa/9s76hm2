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

    const emitProgress = (current: number, total: number, state: string, date?: string) => {
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
            return { synced: 0, skipped: true, reason: "Ticket não encontrado" };
        }

        if (!ticket.whatsapp) {
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não encontrada" };
        }

        if (ticket.channel !== "whatsapp") {
            return { synced: 0, skipped: true, reason: "Canal não suportado para importação" };
        }

        // 2. Obter wbot da conexão
        let wbot: any;
        try {
            wbot = getWbot(ticket.whatsappId);
        } catch (err) {
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

        // 5. Emitir estado "PREPARING"
        emitProgress(0, 0, "PREPARING");

        // 6. Buscar mensagens em batches iterativos
        if (typeof wbot.fetchMessageHistory !== "function") {
            emitProgress(0, 0, "COMPLETED");
            return { synced: 0, skipped: true, reason: "fetchMessageHistory não disponível nesta versão do Baileys" };
        }

        const BATCH_SIZE = 50;
        let allMessages: any[] = [];
        let cursor: any = undefined;
        let cursorTimestamp: number | undefined = undefined;
        let keepFetching = true;
        let fetchAttempts = 0;
        const MAX_FETCH_ATTEMPTS = 100; // Segurança contra loop infinito

        // Usar mensagem mais antiga do ticket como âncora inicial
        const oldestMessage = await Message.findOne({
            where: { ticketId: ticket.id },
            order: [["createdAt", "ASC"]]
        });

        if (oldestMessage?.dataJson) {
            try {
                const parsed = JSON.parse(oldestMessage.dataJson);
                cursor = parsed?.key;
                cursorTimestamp = parsed?.messageTimestamp
                    ? Number(parsed.messageTimestamp)
                    : undefined;
            } catch { }
        }

        logger.info(`[ImportHistory] Iniciando importação para ticketId=${ticketId}, período=${periodMonths} meses, jid=${jid}`);

        while (keepFetching && fetchAttempts < MAX_FETCH_ATTEMPTS) {
            fetchAttempts++;
            try {
                const result = await wbot.fetchMessageHistory(jid, BATCH_SIZE, cursor, cursorTimestamp);

                logger.info(`[ImportHistory] DEBUG: result type=${typeof result}, isArray=${Array.isArray(result)}`);
                // logger.info(`[ImportHistory] DEBUG RAW: ${JSON.stringify(result, null, 2)}`); // Descomente se necessário, pode ser muito verborrágico

                let messages: any[] = [];
                if (Array.isArray(result)) {
                    messages = result;
                } else if (result && typeof result === "object") {
                    messages = result.messages || result.data || [];
                } else if (typeof result === "string") {
                    logger.warn(`[ImportHistory] Baileys retornou string inesperada: "${result.substring(0, 500)}"`);
                }

                logger.debug(`[ImportHistory] fetchMessageHistory retornou ${messages.length} mensagens`);

                if ((!messages || messages.length === 0) && fetchAttempts === 1 && cursor) {
                    logger.warn(`[ImportHistory] Primeira tentativa com cursor falhou. Tentando sem cursor para pegar as mais recentes...`);
                    cursor = undefined;
                    cursorTimestamp = undefined;
                    continue; // Tenta de novo sem cursor
                }

                if (!messages || messages.length === 0) {
                    logger.info(`[ImportHistory] Sem mais mensagens retornadas pelo Baileys.`);
                    keepFetching = false;
                    break;
                }

                // Filtrar pela data de corte se período especificado
                const validMessages = messages.filter(m => {
                    if (!m || !m.key || !m.key.id) return false;
                    if (cutoffTimestamp) {
                        const msgTs = typeof m.messageTimestamp === "object" && m.messageTimestamp.low
                            ? m.messageTimestamp.low
                            : Number(m.messageTimestamp || 0);
                        if (msgTs < cutoffTimestamp) return false;
                    }
                    return true;
                });

                allMessages.push(...validMessages);

                logger.info(`[ImportHistory] Batch ${fetchAttempts}: ${messages.length} msgs recebidas, ${validMessages.length} válidas, total acumulado: ${allMessages.length}`);

                // Se retornou menos que o batch, não há mais mensagens
                if (messages.length < BATCH_SIZE) {
                    keepFetching = false;
                    break;
                }

                // Verificar se alguma mensagem ultrapassou o corte de data
                if (cutoffTimestamp) {
                    const allTimestamps = messages.map(m => {
                        return typeof m.messageTimestamp === "object" && m.messageTimestamp?.low
                            ? m.messageTimestamp.low
                            : Number(m.messageTimestamp || 0);
                    });
                    const oldestTs = Math.min(...allTimestamps);
                    if (oldestTs < cutoffTimestamp) {
                        keepFetching = false;
                        break;
                    }
                }

                // Atualizar cursor para próximo batch (usar mensagem mais antiga do batch atual)
                const lastMsg = messages[messages.length - 1];
                if (lastMsg?.key) {
                    cursor = lastMsg.key;
                    cursorTimestamp = typeof lastMsg.messageTimestamp === "object" && lastMsg.messageTimestamp?.low
                        ? lastMsg.messageTimestamp.low
                        : Number(lastMsg.messageTimestamp || 0);
                } else {
                    keepFetching = false;
                }

                // Emitir progresso de busca
                emitProgress(allMessages.length, 0, "PREPARING", `Buscando... ${allMessages.length} mensagens encontradas`);

                // Delay entre batches para não sobrecarregar
                await new Promise(r => setTimeout(r, 500));
            } catch (err: any) {
                logger.warn(`[ImportHistory] Erro no batch ${fetchAttempts}: ${err?.message}`);
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
