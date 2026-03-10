import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { dataMessages, getWbot, getWbotIsReconnecting } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import { downloadMediaMessage, proto, jidNormalizedUser, WASocket } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import CreateMessageService from "./CreateMessageService";
import { invalidateTicketMessagesCache } from "./MessageCacheService";
import {
  registerHistoryHandler,
  unregisterHistoryHandler,
  registerFetchRequest,
  startFetchRequest,
  cancelFetchRequest
} from "../../libs/messageHistoryHandler";
import { acquireFetchLock } from "../../libs/fetchHistoryMutex";

const writeFileAsync = promisify(fs.writeFile);

const extractFetchedMessages = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.messages)) return payload.messages;
    
    // Baileys pode retornar objeto com chaves numéricas: { 0: msg, 1: msg, ... }
    if (typeof payload === "object" && !Array.isArray(payload)) {
        const keys = Object.keys(payload);
        const numericKeys = keys.filter(k => !isNaN(Number(k)));
        if (numericKeys.length > 0) {
            return numericKeys.map(k => payload[k]).filter(m => m);
        }
    }
    
    if (Array.isArray(payload?.syncData?.messages)) return payload.syncData.messages;
    if (Array.isArray(payload?.historyMessages)) return payload.historyMessages;
    return [];
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const getSessionJidVariants = (wbot: any): string[] => {
    const variants = new Set<string>();
    const sessionJid = wbot?.user?.id;

    if (!sessionJid || typeof sessionJid !== "string") {
        return [];
    }

    variants.add(sessionJid);

    try {
        variants.add(jidNormalizedUser(sessionJid));
    } catch { }

    const [userPart] = sessionJid.split("@");
    const phonePart = userPart?.split(":")[0];

    if (phonePart) {
        variants.add(`${phonePart}@s.whatsapp.net`);
        try {
            variants.add(jidNormalizedUser(`${phonePart}@s.whatsapp.net`));
        } catch { }
    }

    return Array.from(variants).filter(Boolean);
};

const isSelfChatTicket = (ticket: any, wbot: any): boolean => {
    const contactNumber = String(ticket?.contact?.number || "").replace(/\D/g, "");
    const sessionJids = getSessionJidVariants(wbot);

    return sessionJids.some(jid => {
        const [userPart] = jid.split("@");
        const sessionNumber = String(userPart || "").split(":")[0]?.replace(/\D/g, "");
        return Boolean(sessionNumber) && sessionNumber === contactNumber;
    });
};

const chooseMainHistoryJid = (possibleJids: Set<string>, ticket: any, wbot: any): string => {
    const allJids = Array.from(possibleJids).filter(Boolean);
    const sessionJids = getSessionJidVariants(wbot);

    if (isSelfChatTicket(ticket, wbot)) {
        const preferredSessionJid = sessionJids.find(jid => allJids.includes(jid));
        if (preferredSessionJid) {
            return preferredSessionJid;
        }
        if (sessionJids[0]) {
            return sessionJids[0];
        }
    }

    if (ticket?.contact?.remoteJid && allJids.includes(ticket.contact.remoteJid)) {
        return ticket.contact.remoteJid;
    }

    const contactNumber = String(ticket?.contact?.number || "").replace(/\D/g, "");
    if (contactNumber) {
        const preferredContactJid = allJids.find(jid => String(jid).includes(`${contactNumber}@`));
        if (preferredContactJid) {
            return preferredContactJid;
        }
    }

    return allJids[0];
};

const getSessionCachedMessages = async (
    wbot: any,
    whatsappId: number,
    jid: string,
    anchorKey?: any,
    limit: number = 250
): Promise<any[]> => {
    const cacheMessages = (dataMessages[whatsappId] || []).filter((msg: any) => msg?.key?.remoteJid === jid);

    let storeMessages: any[] = [];
    try {
        if (typeof wbot?.store?.loadMessages === "function") {
            const cursor = anchorKey?.id
                ? ({ before: { ...anchorKey, remoteJid: jid } } as any)
                : undefined;
            storeMessages = await wbot.store.loadMessages(jid, limit, cursor, undefined);
        } else if (Array.isArray(wbot?.store?.messages?.[jid]?.array)) {
            const storeArray = wbot.store.messages[jid].array;
            if (anchorKey?.id) {
                const anchorIndex = storeArray.findIndex((msg: any) => msg?.key?.id === anchorKey.id);
                if (anchorIndex > 0) {
                    const startIndex = Math.max(0, anchorIndex - limit);
                    storeMessages = storeArray.slice(startIndex, anchorIndex);
                } else {
                    storeMessages = storeArray.slice(-limit);
                }
            } else {
                storeMessages = storeArray.slice(-limit);
            }
        }
    } catch (error) {
        logger.debug(`[ImportHistory] Falha ao ler store para jid=${jid}: ${(error as Error)?.message}`);
    }

    const merged = [...cacheMessages, ...storeMessages];
    return deduplicateAndSort(merged).filter((msg: any) => msg?.key?.remoteJid === jid);
};

const waitForSessionHistory = async (
    wbot: any,
    whatsappId: number,
    jid: string,
    anchorKey: any,
    baselineIds: Set<string>,
    timeoutMs: number = 5000,
    intervalMs: number = 1000
): Promise<any[]> => {
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
            await sleep(intervalMs);
        }

        const cachedMessages = await getSessionCachedMessages(wbot, whatsappId, jid, anchorKey);
        const newMessages = cachedMessages.filter((msg: any) => {
            const messageId = msg?.key?.id;
            return messageId && !baselineIds.has(messageId);
        });

        if (newMessages.length > 0) {
            logger.info(`[ImportHistory] Histórico encontrado no cache/store da sessão para jid=${jid}: ${newMessages.length} mensagens (tentativa ${attempt}/${maxAttempts})`);
            return newMessages;
        }
    }

    return [];
};

/**
 * Verifica se o socket Baileys está realmente conectado e funcional
 * Usado antes de operações críticas como fetchMessageHistory
 */
const isSocketAlive = (wbot: WASocket, whatsappId?: number): boolean => {
  try {
    // @ts-ignore - ws é uma propriedade interna do Baileys, readyState é number
    const ws = wbot?.ws as { readyState?: number } | undefined;

    // Verificar se tem usuário autenticado
    if (!wbot.user?.id) {
      logger.debug(`[ImportHistory] Socket sem usuário autenticado`);
      return false;
    }

    if (typeof whatsappId === "number" && getWbotIsReconnecting(whatsappId)) {
      logger.debug(`[ImportHistory] Sessão em reconexão para whatsappId=${whatsappId}`);
      return false;
    }

    if (!ws || typeof ws.readyState !== "number") {
      logger.debug(`[ImportHistory] Socket sem ws.readyState; aceitando sessão autenticada para whatsappId=${whatsappId}`);
      return true;
    }

    // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    if (ws.readyState === 1) {
      return true;
    }

    // Blindagem: se a sessão está autenticada e não está reconectando,
    // tolerar CONNECTING momentâneo para evitar falso negativo durante eventos ativos.
    if (ws.readyState === 0) {
      logger.debug(`[ImportHistory] Socket CONNECTING mas autenticado; aceitando para whatsappId=${whatsappId}`);
      return true;
    }

    logger.debug(`[ImportHistory] WebSocket não está utilizável (readyState=${ws.readyState}) para whatsappId=${whatsappId}`);
    return false;
    
  } catch (error) {
    logger.error(`[ImportHistory] Erro ao verificar socket: ${error.message}`);
    return false;
  }
};

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

        if ((ticket.whatsapp as any)?.channelType === "official") {
            logger.info(`[ImportHistory] Pulando ticket ${ticketId}: conexão API Oficial não possui histórico via Baileys/Wbot.`);
            return { synced: 0, skipped: true, reason: "Histórico não suportado para API Oficial" };
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

        const isSelfChat = isSelfChatTicket(ticket, wbot);
        const sessionJids = getSessionJidVariants(wbot);
        if (isSelfChat) {
            for (const sessionJid of sessionJids) {
                possibleJids.add(sessionJid);
            }
        }

        logger.info(`[ImportHistory] JIDs alvo: ${Array.from(possibleJids).join(", ")} | selfChat=${isSelfChat}`);

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
        let allMessages = deduplicateAndSort(contactMessages);

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
                const mainHistoryJid = chooseMainHistoryJid(possibleJids, ticket, wbot);
                let oldestKey: any = {
                    remoteJid: mainHistoryJid,
                    id: "",
                    fromMe: true // tanto faz para âncora inicial se não tiver ID?
                };
                let oldestTimestamp = Math.floor(Date.now() / 1000);

                const oldestInDb = await Message.findOne({
                    where: { ticketId, companyId },
                    order: [["createdAt", "ASC"]]
                });

                if (oldestInDb?.createdAt) {
                    oldestTimestamp = Math.floor(new Date(oldestInDb.createdAt).getTime() / 1000) || oldestTimestamp;
                }

                if (oldestInDb && oldestInDb.dataJson) {
                    try {
                        const parsed = JSON.parse(oldestInDb.dataJson);
                        if (parsed.key) {
                            oldestKey = parsed.key;
                            if (!possibleJids.has(oldestKey.remoteJid) && mainHistoryJid) {
                                oldestKey.remoteJid = mainHistoryJid;
                            }
                            oldestTimestamp = Number(parsed.messageTimestamp) || oldestTimestamp;
                            logger.info(`[ImportHistory] Usando mensagem DB como âncora: ${oldestKey.id} (${oldestTimestamp})`);
                        }
                    } catch { }
                }

                // 2. Setup de captura (Promessa)
                const mainJid = chooseMainHistoryJid(possibleJids, ticket, wbot) || oldestKey.remoteJid;
                oldestKey.remoteJid = mainJid;

                try {
                    emitProgress(0, -1, "FETCHING", "Solicitando histórico ao WhatsApp...");
                    
                    const tempHandler = (msgs: any[]) => {
                        allMessages.push(...msgs);
                    };
                    
                    registerHistoryHandler(mainJid, tempHandler);

                    // =====================================================================
                    // PROTEÇÃO: Mutex por whatsappId + Rate Limiting
                    // =====================================================================
                    let releaseLock: (() => void) | null = null;
                    let activeFetchId: string | null = null;

                    try {
                        // Adquirir lock ANTES de chamar fetchMessageHistory
                        releaseLock = await acquireFetchLock(whatsappId, `ImportHistory-${ticketId}`);
                        
                        // CRÍTICO: Verificar se socket está vivo antes de chamar fetchMessageHistory
                        if (!isSocketAlive(wbot, whatsappId)) {
                            logger.warn(`[ImportHistory] Socket não está vivo para whatsappId=${whatsappId}, abortando fetch`);
                            throw new Error("Socket not alive");
                        }

                        const baselineMessages = await getSessionCachedMessages(wbotAny, whatsappId, mainJid, oldestKey);
                        const baselineIds = new Set(baselineMessages.map((msg: any) => msg?.key?.id).filter(Boolean));

                        activeFetchId = registerFetchRequest(mainJid);
                        const fetchPromise = startFetchRequest(activeFetchId, mainJid, 30000); // 30s timeout real após lock
                        
                        // Disparar o fetch - buscar 200 mensagens em vez de 50
                        const fetchResponse = await wbotAny.fetchMessageHistory(200, oldestKey, oldestTimestamp)
                            .catch((err: any) => {
                                logger.warn(`[ImportHistory] Falha ao chamar API fetchMessageHistory: ${err}`);
                                throw err;
                            });

                        const fetchedDirectMessages = extractFetchedMessages(fetchResponse);
                        if (fetchResponse) {
                            const responseKeys = Array.isArray(fetchResponse) ? ["array"] : Object.keys(fetchResponse);
                            logger.info(`[ImportHistory] fetchMessageHistory retornou resposta direta: keys=[${responseKeys.join(",")}] msgs=${fetchedDirectMessages.length}`);
                        }

                        if (fetchedDirectMessages.length > 0) {
                            allMessages = fetchedDirectMessages;
                        } else {
                            const storeMessages = await waitForSessionHistory(wbotAny, whatsappId, mainJid, oldestKey, baselineIds, 5000, 1000);
                            if (storeMessages.length > 0) {
                                allMessages = storeMessages;
                            } else {
                                const result = await fetchPromise;
                                allMessages = result.messages;
                            }
                        }
                        
                        // Repassar dedup
                        const uniqueFetched = deduplicateAndSort(allMessages);
                        allMessages.length = 0; // limpar original
                        allMessages.push(...uniqueFetched);

                        logger.info(`[ImportHistory] Recuperado via API: ${allMessages.length} mensagens.`);

                        // Opcional: Popular o cache dataMessages com o que veio
                        if (!dataMessages[whatsappId]) dataMessages[whatsappId] = [];
                        dataMessages[whatsappId].unshift(...allMessages);

                    } catch (fetchErr: any) {
                        logger.warn(`[ImportHistory] Erro na Fase 2: ${fetchErr}`);
                        
                        // Se foi erro de rate limit, propagar
                        if (fetchErr?.message?.includes('Rate limit')) {
                            throw fetchErr;
                        }
                        
                        // Retry uma vez após 3s (sem adquirir novo lock, já temos)
                        try {
                            logger.info("[ImportHistory] Tentando retry após 3s...");
                            await new Promise(r => setTimeout(r, 3000));
                            
                            // Verificar se socket ainda está vivo antes do retry
                            if (!isSocketAlive(wbot, whatsappId)) {
                                logger.warn(`[ImportHistory] Socket morreu durante espera de retry, abortando`);
                                throw new Error("Socket not alive during retry");
                            }

                            const retryBaselineMessages = await getSessionCachedMessages(wbotAny, whatsappId, mainJid, oldestKey);
                            const retryBaselineIds = new Set(retryBaselineMessages.map((msg: any) => msg?.key?.id).filter(Boolean));

                            if (activeFetchId) {
                                cancelFetchRequest(activeFetchId);
                            }
                            
                            activeFetchId = registerFetchRequest(mainJid);
                            const retryPromise = startFetchRequest(activeFetchId, mainJid, 30000);
                            const retryResponse = await wbotAny.fetchMessageHistory(200, oldestKey, oldestTimestamp);
                            const retryDirectMessages = extractFetchedMessages(retryResponse);

                            if (retryResponse) {
                                const retryKeys = Array.isArray(retryResponse) ? ["array"] : Object.keys(retryResponse);
                                logger.info(`[ImportHistory] Retry fetchMessageHistory retornou resposta direta: keys=[${retryKeys.join(",")}] msgs=${retryDirectMessages.length}`);
                            }

                            if (retryDirectMessages.length > 0) {
                                allMessages = retryDirectMessages;
                            } else {
                                const retryStoreMessages = await waitForSessionHistory(wbotAny, whatsappId, mainJid, oldestKey, retryBaselineIds, 5000, 1000);
                                if (retryStoreMessages.length > 0) {
                                    allMessages = retryStoreMessages;
                                } else {
                                    const retryResult = await retryPromise;
                                    allMessages = retryResult.messages;
                                }
                            }
                            
                            const uniqueFetched = deduplicateAndSort(allMessages);
                            allMessages.length = 0;
                            allMessages.push(...uniqueFetched);
                            
                            logger.info(`[ImportHistory] Retry bem-sucedido: ${allMessages.length} mensagens`);
                            
                            if (!dataMessages[whatsappId]) dataMessages[whatsappId] = [];
                            dataMessages[whatsappId].unshift(...allMessages);
                            
                        } catch (retryErr: any) {
                            logger.warn(`[ImportHistory] Retry falhou: ${retryErr}`);
                        }
                    } finally {
                        // Liberar lock SEMPRE
                        if (releaseLock) {
                            releaseLock();
                        }
                        
                        unregisterHistoryHandler(mainJid, tempHandler);
                        if (activeFetchId) {
                            cancelFetchRequest(activeFetchId);
                        }
                    }

                } catch (err: any) {
                    logger.warn(`[ImportHistory] Erro geral na Fase 2: ${err}`);
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

                // Salvar mensagem via CreateMessageService (invalida cache e emite Socket)
                // NOTA: ticketImported=true indica que é mensagem importada (não tempo real)
                const messageData = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: ticket.contactId, // SEMPRE usar ticket.contactId (nunca undefined)
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

                await CreateMessageService({ messageData, companyId });
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
