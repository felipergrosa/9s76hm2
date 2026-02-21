import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { dataMessages, getWbot } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import { downloadMediaMessage, proto, jidNormalizedUser } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);

// ============================================================
//  Funções Auxiliares
// ============================================================

/**
 * Extrai o tipo da mensagem
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
        "liveLocationMessage",
        "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
        "documentWithCaptionMessage",
        "ephemeralMessage",
        "reactionMessage",
        "pollCreationMessage", "pollCreationMessageV2", "pollCreationMessageV3", "pollUpdateMessage",
        "buttonsMessage", "buttonsResponseMessage",
        "listMessage", "listResponseMessage",
        "templateMessage", "templateButtonReplyMessage",
        "editedMessage", "protocolMessage",
        "orderMessage", "paymentInviteMessage",
        "productMessage",
        "imageWithCaptionMessage",
        "newsletterAdminInviteMessage",
    ];
    return validTypes.includes(msgType);
};

/**
 * Remove duplicatas pelo key.id e ordena por timestamp ASC
 */
function deduplicateAndSort(array: any[]): any[] {
    const seen = new Map<string, any>();
    for (const msg of array) {
        const id = msg?.key?.id;
        if (id && !seen.has(id)) {
            seen.set(id, msg);
        }
    }
    return Array.from(seen.values()).sort((a, b) =>
        (Number(a.messageTimestamp) || 0) - (Number(b.messageTimestamp) || 0)
    );
}

// ============================================================
//  Interfaces
// ============================================================

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

// ============================================================
//  Serviço Principal (Reescrito — Estratégia dataMessages)
// ============================================================

/**
 * Importa histórico de mensagens de um contato do WhatsApp.
 *
 * Estratégia segura (sem fechar websocket):
 * 1. Busca mensagens do cache `dataMessages[whatsappId]` filtradas pelo JID do contato
 * 2. Deduplicação em batch contra o banco
 * 3. Salva mensagens novas com download de mídia opcional
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
            return { synced: 0, skipped: true, reason: "Canal não suportado para importação" };
        }

        const whatsappId = ticket.whatsappId;

        // 2. Verificar wbot ativo
        let wbot: any;
        try {
            wbot = getWbot(whatsappId);
        } catch (err: any) {
            logger.error(`[ImportHistory] Wbot não disponível: ${err.message}`);
            return { synced: 0, skipped: true, reason: "Conexão WhatsApp não inicializada" };
        }

        // 3. Montar JIDs possíveis do contato (para filtrar dataMessages)
        const contactNumber = ticket.contact.number;
        const possibleJids = new Set<string>();

        // JID padrão
        if (ticket.isGroup) {
            possibleJids.add(contactNumber.includes("@g.us") ? contactNumber : `${contactNumber}@g.us`);
        } else {
            possibleJids.add(contactNumber.includes("@s.whatsapp.net") ? contactNumber : `${contactNumber}@s.whatsapp.net`);
            // Também incluir versão normalizada
            try {
                const normalized = jidNormalizedUser(`${contactNumber}@s.whatsapp.net`);
                possibleJids.add(normalized);
            } catch { }
        }

        // Incluir remoteJid do contato se disponível
        if (ticket.contact.remoteJid) {
            possibleJids.add(ticket.contact.remoteJid);
        }

        logger.info(`[ImportHistory] JIDs alvo: ${Array.from(possibleJids).join(", ")}`);

        // 4. Calcular data de corte
        let cutoffTimestamp: number | null = null;
        if (periodMonths > 0) {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
            cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);
        }

        // 5. Emitir estado "FETCHING"
        emitProgress(0, -1, "FETCHING", "Buscando mensagens do cache...");

        // ============================================================
        //  BUSCA DE MENSAGENS (do dataMessages — sem fechar websocket)
        // ============================================================
        const rawMessages = dataMessages[whatsappId] || [];

        // Filtrar mensagens do contato alvo
        const contactMessages = rawMessages.filter((msg: any) => {
            if (!msg?.key?.remoteJid) return false;

            // Verificar se é do JID alvo
            if (!possibleJids.has(msg.key.remoteJid)) return false;

            // Filtrar por período
            if (cutoffTimestamp) {
                const msgTs = Number(
                    typeof msg.messageTimestamp === "object" && msg.messageTimestamp?.low
                        ? msg.messageTimestamp.low
                        : msg.messageTimestamp || 0
                );
                if (msgTs < cutoffTimestamp) return false;
            }

            return true;
        });

        // Deduplicar e ordenar
        const allMessages = deduplicateAndSort(contactMessages);

        logger.info(`[ImportHistory] ${allMessages.length} mensagens encontradas para o contato (de ${rawMessages.length} total em cache)`);


        // ============================================================
        //  FASE 2 — ESTRATÉGIA HÍBRIDA (On-Demand Fetch)
        //  Se não encontrou no cache, solicitar ao WhatsApp (sem derrubar conexão)
        // ============================================================

        if (allMessages.length === 0) {
            logger.info("[ImportHistory] Cache local vazio. Tentando buscar histórico via API (fetchMessageHistory)...");

            const wbotAny = wbot as any;
            if (typeof wbotAny.fetchMessageHistory === "function") {
                // 1. Definir mensagem âncora (a partir da qual buscaremos para trás)
                // Se tiver mensagem no banco, usa a mais antiga. Se não, usa "agora".
                let oldestKey: any = {
                    remoteJid: ticket.contact.remoteJid || `${ticket.contact.number}@s.whatsapp.net`,
                    id: "",
                    fromMe: true // tanto faz para âncora inicial se não tiver ID?
                };
                let oldestTimestamp = Math.floor(Date.now() / 1000);

                const oldestInDb = await Message.findOne({
                    where: { ticketId, companyId },
                    order: [["timestamp", "ASC"]]
                });

                if (oldestInDb && oldestInDb.dataJson) {
                    try {
                        const parsed = JSON.parse(oldestInDb.dataJson);
                        if (parsed.key) {
                            oldestKey = parsed.key;
                            oldestTimestamp = Number(parsed.messageTimestamp) || oldestTimestamp;
                            logger.info(`[ImportHistory] Usando mensagem DB como âncora: ${oldestKey.id} (${oldestTimestamp})`);
                        }
                    } catch { }
                }

                // 2. Setup de captura (Promessa)
                const mainJid = oldestKey.remoteJid;

                try {
                    emitProgress(0, -1, "FETCHING", "Solicitando histórico ao WhatsApp...");

                    const fetchedMessages = await new Promise<any[]>((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            cleanup();
                            resolve([]);
                        }, 20000); // 20s timeout

                        const historyHandler = (event: any) => {
                            // O evento traz { messages: [...], isLatest: boolean, ... }
                            const msgs = event?.messages || [];
                            // Filtrar apenas do JID que queremos
                            const relevant = msgs.filter((m: any) => m?.key?.remoteJid === mainJid);

                            if (relevant.length > 0) {
                                logger.info(`[ImportHistory] Recebido history sync: ${relevant.length} mensagens relevantes.`);
                                cleanup();
                                clearTimeout(timeoutId);
                                resolve(relevant);
                            }
                        };

                        const cleanup = () => {
                            wbot.ev.off("messaging-history.set", historyHandler);
                        };

                        wbot.ev.on("messaging-history.set", historyHandler);

                        // Disparar o fetch
                        // fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp)
                        wbotAny.fetchMessageHistory(50, oldestKey, oldestTimestamp)
                            .catch((err: any) => {
                                clearTimeout(timeoutId);
                                cleanup();
                                logger.warn(`[ImportHistory] Falha ao chamar API fetchMessageHistory: ${err}`);
                                resolve([]);
                            });
                    });

                    // Adicionar ao allMessages
                    if (fetchedMessages.length > 0) {
                        for (const msg of fetchedMessages) {
                            allMessages.push(msg);
                        }
                        // Repassar dedup
                        const uniqueFetched = deduplicateAndSort(allMessages);
                        allMessages.length = 0; // limpar original
                        allMessages.push(...uniqueFetched);

                        logger.info(`[ImportHistory] Recuperado via API: ${allMessages.length} mensagens.`);

                        // Opcional: Popular o cache dataMessages com o que veio
                        if (!dataMessages[whatsappId]) dataMessages[whatsappId] = [];
                        dataMessages[whatsappId].unshift(...fetchedMessages);
                    }

                } catch (fetchErr) {
                    logger.warn(`[ImportHistory] Erro na Fase 2: ${fetchErr}`);
                }
            } else {
                logger.warn("[ImportHistory] fetchMessageHistory não disponível nesta versão do Baileys.");
            }
        }

        if (allMessages.length === 0) {
            emitProgress(0, 0, "COMPLETED", "Nenhuma mensagem encontrada (Cache e API vazios)");
            // Auto-fechar progresso
            setTimeout(() => {
                io.of(namespace).emit(eventName, { action: "refresh" });
            }, 3000);
            return { synced: 0, skipped: false, reason: "Nenhuma mensagem encontrada no cache ou servidor." };
        }


        // ============================================================
        //  DEDUPLICAÇÃO EM BATCH (contra o banco)
        // ============================================================
        emitProgress(0, allMessages.length, "PREPARING", "Verificando duplicatas...");

        const allWids = allMessages.map((m: any) => m.key.id).filter(Boolean);
        const existingWids = new Set<string>();
        const chunkSize = 1000;

        for (let i = 0; i < allWids.length; i += chunkSize) {
            const chunk = allWids.slice(i, i + chunkSize);
            const existing = await Message.findAll({
                where: {
                    wid: { [Op.in]: chunk },
                    companyId
                },
                attributes: ["wid"]
            });
            existing.forEach((m: any) => existingWids.add(m.wid));
        }

        const messagesToImport = allMessages.filter((m: any) => !existingWids.has(m.key.id));
        const totalImport = messagesToImport.length;

        logger.info(`[ImportHistory] Novas: ${totalImport}, Existentes ignoradas: ${existingWids.size}`);

        if (totalImport === 0) {
            emitProgress(0, 0, "COMPLETED", "Todas as mensagens já estão importadas");
            setTimeout(() => {
                io.of(namespace).emit(eventName, { action: "refresh" });
            }, 3000);
            return { synced: 0, skipped: false, reason: "Todas as mensagens já existem no banco" };
        }

        // ============================================================
        //  IMPORTAÇÃO
        // ============================================================
        emitProgress(0, totalImport, "IMPORTING");

        let syncedCount = 0;
        let processedCount = 0;

        for (const msg of messagesToImport) {
            processedCount++;

            try {
                if (!msg?.key?.id) continue;

                // Validar mensagem
                if (!isImportableMessage(msg)) continue;

                // Extrair dados
                const messageType = getMessageType(msg);
                const messageBody = getBodyMessage(msg) || "";

                // Timestamp
                const timestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === "object" && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : Number(msg.messageTimestamp))
                    : Math.floor(Date.now() / 1000);

                const originalDate = new Date(timestamp * 1000);

                // Determinar se é mídia
                const isMediaType = [
                    "imageMessage", "videoMessage", "audioMessage", "voiceMessage",
                    "documentMessage", "stickerMessage", "documentWithCaptionMessage",
                    "ptvMessage"
                ].includes(messageType);

                let mediaUrl: string | null = null;
                let finalMediaType = messageType;

                // Tentar baixar mídia
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
                            // Mídia antiga pode não estar mais disponível — isso é normal
                            logger.debug(`[ImportHistory] Mídia indisponível msg ${msg.key.id}: ${downloadErr?.message}`);
                        }

                        if (buffer) {
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
                                    const ext = mineType.mimetype.split("/")[1]?.split(";")[0] || "bin";
                                    filename = `${Date.now()}_${msg.key.id.slice(-6)}.${ext}`;
                                } else {
                                    filename = `${Date.now()}_${filename}`;
                                }

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
                                const mimeBase = mineType.mimetype.split("/")[0];
                                if (messageType === "stickerMessage" || mineType.mimetype === "image/webp") {
                                    finalMediaType = "sticker";
                                } else {
                                    finalMediaType = mimeBase;
                                }
                            }
                        }
                    } catch (mediaErr: any) {
                        logger.debug(`[ImportHistory] Erro mídia: ${mediaErr?.message}`);
                    }
                }

                // Salvar mensagem via upsert (mais rápido que CreateMessageService)
                const messageData = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: msg.key.fromMe ? undefined : ticket.contactId,
                    body: messageBody || (mediaUrl ? "Mídia" : ""),
                    fromMe: msg.key.fromMe || false,
                    mediaType: mediaUrl ? finalMediaType : (messageBody ? "chat" : messageType),
                    mediaUrl,
                    read: true,
                    ack: msg.status || 0,
                    remoteJid: msg.key.remoteJid || ticket.contact?.remoteJid,
                    participant: msg.key.participant || null,
                    dataJson: JSON.stringify(msg),
                    ticketImported: true,
                    timestamp: timestamp * 1000,
                    createdAt: originalDate,
                    updatedAt: originalDate,
                    companyId
                };

                await Message.upsert(messageData);
                syncedCount++;

            } catch (msgErr: any) {
                logger.warn(`[ImportHistory] Erro msg ${processedCount}: ${msgErr?.message}`);
            }

            // Emitir progresso a cada 10 mensagens ou na última
            if (processedCount % 10 === 0 || processedCount === totalImport) {
                const msgTs = msg.messageTimestamp
                    ? Number(typeof msg.messageTimestamp === "object" && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : msg.messageTimestamp) * 1000
                    : Date.now();

                emitProgress(
                    processedCount,
                    totalImport,
                    "IMPORTING",
                    new Date(msgTs).toLocaleDateString("pt-BR")
                );
            }

            // Throttle mínimo
            if (processedCount % 20 === 0) {
                await new Promise(r => setTimeout(r, 50));
            }
        }

        // ============================================================
        //  FINALIZAÇÃO
        // ============================================================
        emitProgress(totalImport, totalImport, "COMPLETED");

        // Refresh do ticket na UI
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
