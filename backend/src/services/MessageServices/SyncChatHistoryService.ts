import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";
import CreateMessageService from "./CreateMessageService";
import { isValidMsg, getTypeMessage, getBodyMessage } from "../WbotServices/wbotMessageListener";

// Cache para throttling (evita sync repetido em curto período)
const lastSyncTime = new Map<string, number>();
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

interface SyncChatHistoryParams {
    ticketId: string | number;
    companyId: number;
    messageCount?: number;
    forceSync?: boolean;
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
    messageCount = 50,
    forceSync = false
}: SyncChatHistoryParams): Promise<SyncResult> => {
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

        // 6. Forçar sincronização completa antes de buscar
        try {
            await wbot.chatModify({
                markRead: false,
                archive: false,
                lastMessages: []
            }, jid);

            // Esperar um pouco para o WhatsApp processar
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Marcar como lido novamente
            await wbot.chatModify({
                markRead: true,
                lastMessages: []
            }, jid);

            // logger.info(`[SyncChatHistory] Sync via chatModify concluído`);
        } catch (err: any) {
            logger.warn(`[SyncChatHistory] Erro ao forçar sync via chatModify: ${err?.message}`);
        }

        // 7. Usar loadMessages do store do Baileys (método mais confiável)
        let messages: any[] = [];
        try {
            if (wbot.store && typeof wbot.store.loadMessages === "function") {
                // logger.info(`[SyncChatHistory] Carregando ${messageCount} mensagens do store para jid=${jid}`);

                // loadMessages do store é síncrono e mais confiável
                messages = await wbot.store.loadMessages(
                    jid,
                    messageCount,
                    undefined, // cursor - undefined para pegar as mais recentes
                    undefined // sock - undefined para store local
                );

                // logger.info(`[SyncChatHistory] loadMessages retornou ${messages.length} mensagens`);
            } else {
                // Fallback: tentar chatModify para marcar como lido e forçar sync
                // logger.warn(`[SyncChatHistory] Store ou loadMessages não disponível, usando fallback`);

                // Marcar chat como lido pode ajudar a sincronizar
                try {
                    await wbot.chatModify({ markRead: true }, jid);
                } catch { }

                return { synced: 0, skipped: true, reason: "Store não disponível nesta versão do Baileys" };
            }
        } catch (err: any) {
            logger.warn(`[SyncChatHistory] Erro ao buscar histórico: ${err?.message}`);
            return { synced: 0, skipped: true, reason: `Erro ao buscar: ${err?.message}` };
        }

        if (!messages || messages.length === 0) {
            lastSyncTime.set(throttleKey, now);
            return { synced: 0, skipped: false, reason: "Nenhuma mensagem nova encontrada" };
        }

        // 7. Processar e salvar mensagens novas
        let syncedCount = 0;
        const io = getIO();

        // Filtrar mensagens válidas (remover undefined/null que podem vir do Baileys)
        const validMessages = messages.filter(m => m && m.key && m.key.id);

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
                    continue;
                }

                // Extrair dados da mensagem
                const messageType = getTypeMessage(msg);
                const messageBody = getBodyMessage(msg) || "";

                // Validar timestamp
                const timestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'object' && msg.messageTimestamp.low
                        ? msg.messageTimestamp.low
                        : Number(msg.messageTimestamp))
                    : Math.floor(Date.now() / 1000);

                const messageData = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: ticket.contactId,
                    body: messageBody,
                    fromMe: msg.key.fromMe || false,
                    mediaType: messageType,
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

        return { synced: syncedCount, skipped: false };

    } catch (err: any) {
        logger.error(`[SyncChatHistory] Erro geral: ${err?.message}`);
        return { synced: 0, skipped: true, reason: `Erro: ${err?.message}` };
    }
};

export default SyncChatHistoryService;
