/**
 * VerifyInactivityTimeoutJob.ts
 * 
 * Job que verifica tickets inativos e executa ação de timeout
 * configurada no AI Agent (fechar ou transferir)
 */

import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import AIAgent from "../models/AIAgent";
import Queue from "../models/Queue";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { getWbot } from "../libs/wbot";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";

// Intervalo de verificação em milissegundos (1 minuto)
const CHECK_INTERVAL_MS = 60 * 1000;

interface InactiveTicket {
    ticket: Ticket;
    agent: AIAgent;
    minutesInactive: number;
}

/**
 * Busca tickets que estão inativos além do timeout configurado no agente
 */
async function findInactiveTickets(): Promise<InactiveTicket[]> {
    const result: InactiveTicket[] = [];

    try {
        // Buscar todos os agentes com timeout configurado
        const agents = await AIAgent.findAll({
            where: {
                status: "active",
                inactivityTimeoutMinutes: {
                    [Op.gt]: 0
                }
            }
        });

        if (agents.length === 0) {
            return result;
        }

        for (const agent of agents) {
            // Pegar as filas vinculadas ao agente
            const queueIds = agent.queueIds || [];
            if (queueIds.length === 0) continue;

            const timeoutMinutes = agent.inactivityTimeoutMinutes;
            const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

            // Buscar tickets em status "bot" que estão inativos
            const tickets = await Ticket.findAll({
                where: {
                    queueId: { [Op.in]: queueIds },
                    status: "bot",
                    companyId: agent.companyId,
                    updatedAt: {
                        [Op.lt]: cutoffTime
                    }
                },
                include: [
                    { model: Queue, as: "queue" }
                ]
            });

            for (const ticket of tickets) {
                const minutesInactive = Math.floor(
                    (Date.now() - new Date(ticket.updatedAt).getTime()) / (60 * 1000)
                );
                result.push({ ticket, agent, minutesInactive });
            }
        }
    } catch (error) {
        logger.error("[InactivityTimeout] Erro ao buscar tickets inativos:", error);
    }

    return result;
}

/**
 * Envia mensagem de timeout para o cliente
 */
async function sendTimeoutMessage(ticket: Ticket, message: string): Promise<void> {
    try {
        const wbot = await getWbot(ticket.whatsappId);
        const contact = await ticket.$get("contact");
        
        if (!contact) {
            logger.warn(`[InactivityTimeout] Contato não encontrado para ticket ${ticket.id}`);
            return;
        }

        const jid = `${contact.number}@s.whatsapp.net`;
        
        // Verificar se é API Oficial ou Baileys
        if ((wbot as any).channelType === "official" || (wbot as any).isOfficial) {
            await (wbot as any).sendTextMessage(jid, message);
        } else {
            await wbot.sendMessage(jid, { text: message });
        }

        logger.info(`[InactivityTimeout] Mensagem de timeout enviada para ticket ${ticket.id}`);
    } catch (error) {
        logger.error(`[InactivityTimeout] Erro ao enviar mensagem para ticket ${ticket.id}:`, error);
    }
}

/**
 * Processa um ticket inativo
 */
async function processInactiveTicket(item: InactiveTicket): Promise<void> {
    const { ticket, agent, minutesInactive } = item;

    logger.info(`[InactivityTimeout] Processando ticket ${ticket.id} (inativo há ${minutesInactive} min)`);

    try {
        // Enviar mensagem de timeout se configurada
        if (agent.inactivityMessage) {
            await sendTimeoutMessage(ticket, agent.inactivityMessage);
        }

        // Executar ação configurada
        if (agent.inactivityAction === "transfer") {
            // Transferir para fila (status pending)
            await UpdateTicketService({
                ticketData: {
                    status: "pending",
                    isBot: false
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            });
            logger.info(`[InactivityTimeout] Ticket ${ticket.id} transferido para fila`);
        } else {
            // Fechar ticket (status closed)
            await UpdateTicketService({
                ticketData: {
                    status: "closed",
                    isBot: false
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            });
            logger.info(`[InactivityTimeout] Ticket ${ticket.id} fechado por inatividade`);
        }

        // Emitir evento de socket para atualizar frontend
        const io = getIO();
        io.to(`company-${ticket.companyId}-open`)
            .to(`company-${ticket.companyId}-${ticket.status}`)
            .emit(`company-${ticket.companyId}-ticket`, {
                action: "update",
                ticket
            });

    } catch (error) {
        logger.error(`[InactivityTimeout] Erro ao processar ticket ${ticket.id}:`, error);
    }
}

/**
 * Executa verificação de tickets inativos
 */
async function runInactivityCheck(): Promise<void> {
    try {
        const inactiveTickets = await findInactiveTickets();

        if (inactiveTickets.length > 0) {
            logger.info(`[InactivityTimeout] Encontrados ${inactiveTickets.length} tickets inativos`);
            
            for (const item of inactiveTickets) {
                await processInactiveTicket(item);
            }
        }
    } catch (error) {
        logger.error("[InactivityTimeout] Erro na verificação:", error);
    }
}

/**
 * Inicia o job de verificação de inatividade
 */
export function startInactivityTimeoutJob(): void {
    logger.info("[InactivityTimeout] Job iniciado - verificando a cada 1 minuto");
    
    // Executar imediatamente na primeira vez
    runInactivityCheck();
    
    // Agendar execução periódica
    setInterval(runInactivityCheck, CHECK_INTERVAL_MS);
}

export default startInactivityTimeoutJob;
