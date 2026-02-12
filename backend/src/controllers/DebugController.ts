import { Request, Response } from "express";
import { getWbot } from "../libs/wbot";
import logger from "../utils/logger";
import Ticket from "../models/Ticket";
import Message from "../models/Message";

/**
 * Controller para debug de importação de mensagens
 */
export const debugImportHistory = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { companyId } = req.user;

    try {
        // Buscar ticket
        const ticket = await Ticket.findByPk(ticketId, {
            include: [
                { model: Message, as: "messages", limit: 5, order: [["createdAt", "DESC"]] }
            ]
        });

        if (!ticket) {
            return res.status(404).json({ error: "Ticket não encontrado" });
        }

        // Obter wbot
        const wbot = getWbot(ticket.whatsappId);

        // Verificar store
        const hasStore = !!wbot.store;
        const hasLoadMessages = wbot.store && typeof wbot.store.loadMessages === "function";

        // Montar JID
        let jid = ticket.contact.number;
        if (ticket.isGroup) {
            jid = jid.includes("@g.us") ? jid : `${jid}@g.us`;
        } else {
            jid = jid.includes("@s.whatsapp.net") ? jid : `${jid}@s.whatsapp.net`;
        }

        // Tentar carregar mensagens do store
        let storeMessages: any[] = [];
        if (hasLoadMessages) {
            try {
                storeMessages = await wbot.store.loadMessages(jid, 10, undefined, undefined);
                logger.info(`[Debug] Store retornou ${storeMessages.length} mensagens`);
            } catch (err: any) {
                logger.error(`[Debug] Erro ao carregar do store: ${err?.message}`);
            }
        }

        // Verificar mensagens no banco
        const dbMessages = await Message.findAll({
            where: { ticketId: ticket.id },
            order: [["createdAt", "DESC"]],
            limit: 10
        });

        return res.json({
            ticket: {
                id: ticket.id,
                contactId: ticket.contactId,
                contactNumber: ticket.contact.number,
                isGroup: ticket.isGroup,
                jid
            },
            wbot: {
                hasStore,
                hasLoadMessages,
                storeKeys: wbot.store ? Object.keys(wbot.store) : []
            },
            storeMessages: {
                count: storeMessages.length,
                messages: storeMessages.map(m => ({
                    id: m.key?.id,
                    fromMe: m.key?.fromMe,
                    timestamp: m.messageTimestamp,
                    body: m.messageType || "unknown"
                }))
            },
            database: {
                messageCount: dbMessages.length,
                messages: dbMessages.map(m => ({
                    id: m.id,
                    wid: m.wid,
                    fromMe: m.fromMe,
                    createdAt: m.createdAt,
                    body: m.body?.substring(0, 50) || ""
                }))
            }
        });

    } catch (error: any) {
        logger.error(`[Debug] Erro: ${error?.message}`);
        return res.status(500).json({ error: error?.message || "Erro interno" });
    }
};

/**
 * Testar chatModify
 */
export const debugChatModify = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { companyId } = req.user;

    try {
        const ticket = await Ticket.findByPk(ticketId);
        if (!ticket) {
            return res.status(404).json({ error: "Ticket não encontrado" });
        }

        const wbot = getWbot(ticket.whatsappId);

        // Montar JID
        let jid = ticket.contact.number;
        if (ticket.isGroup) {
            jid = jid.includes("@g.us") ? jid : `${jid}@g.us`;
        } else {
            jid = jid.includes("@s.whatsapp.net") ? jid : `${jid}@s.whatsapp.net`;
        }

        // Testar chatModify
        await wbot.chatModify({ 
            markRead: false,
            lastMessages: []
        }, jid);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await wbot.chatModify({ 
            markRead: true,
            lastMessages: []
        }, jid);

        return res.json({
            success: true,
            message: "chatModify executado com sucesso",
            jid
        });

    } catch (error: any) {
        logger.error(`[Debug] Erro chatModify: ${error?.message}`);
        return res.status(500).json({ error: error?.message || "Erro ao executar chatModify" });
    }
};
