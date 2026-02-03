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

        // 4. Montar JID do contato
        const jid = ticket.isGroup
            ? `${ticket.contact.number}@g.us`
            : `${ticket.contact.number}@s.whatsapp.net`;

        // 5. Buscar última mensagem do banco para usar como âncora
        const lastMessage = await Message.findOne({
            where: { ticketId: ticket.id },
            order: [["createdAt", "DESC"]]
        });

        // 6. Chamar fetchMessageHistory do Baileys
        let messages: any[] = [];
        try {
            if (typeof wbot.fetchMessageHistory === "function") {
                // Usar a última mensagem como âncora se existir
                const cursor = lastMessage?.dataJson
                    ? JSON.parse(lastMessage.dataJson)?.key
                    : undefined;

                messages = await wbot.fetchMessageHistory(messageCount, cursor, undefined);
                logger.info(`[SyncChatHistory] Recebidas ${messages?.length || 0} mensagens para ticketId=${ticketId}`);
            } else {
                // Fallback: tentar chatModify para marcar como lido e forçar sync
                logger.warn(`[SyncChatHistory] fetchMessageHistory não disponível, usando fallback`);

                // Marcar chat como lido pode ajudar a sincronizar
                try {
                    await wbot.chatModify({ markRead: true }, jid);
                } catch { }

                return { synced: 0, skipped: true, reason: "fetchMessageHistory não disponível nesta versão do Baileys" };
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

        for (const msg of messages) {
            try {
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

                const messageData = {
                    wid: msg.key.id,
                    ticketId: ticket.id,
                    contactId: ticket.contactId,
                    body: messageBody,
                    fromMe: msg.key.fromMe,
                    mediaType: messageType,
                    read: true,
                    ack: msg.status || 0,
                    remoteJid: msg.key.remoteJid,
                    participant: msg.key.participant || null,
                    dataJson: JSON.stringify(msg),
                    createdAt: new Date(msg.messageTimestamp * 1000),
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
