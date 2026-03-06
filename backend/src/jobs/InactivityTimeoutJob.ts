import Ticket from "../models/Ticket";
import AIAgent from "../models/AIAgent";
import Queue from "../models/Queue";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { getWbot } from "../libs/wbot";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";

/**
 * Job Bull Queue: InactivityTimeout
 * 
 * Processa UM ticket específico que atingiu timeout de inatividade.
 * 
 * Trigger:
 * - Message.afterCreate (quando mensagem é recebida)
 * - Ticket.afterUpdate (quando ticket muda de status)
 * - Agenda job com delay = inactivityTimeoutMinutes
 * 
 * Substitui: VerifyInactivityTimeoutJob (polling 1 min)
 */
export default {
  key: `${process.env.DB_NAME}-InactivityTimeout`,

  async handle({ data }: { data: any }) {
    const { ticketId, agentId, companyId } = data || {};

    if (!ticketId || !agentId || !companyId) {
      throw new Error("[InactivityTimeoutJob] ticketId, agentId e companyId obrigatórios");
    }

    logger.info(`[InactivityTimeoutJob] Processando ticket ${ticketId}`);

    try {
      // Buscar ticket atualizado
      const ticket = await Ticket.findByPk(ticketId, {
        include: [
          { model: Queue, as: "queue" }
        ]
      });

      if (!ticket) {
        logger.warn(`[InactivityTimeoutJob] Ticket ${ticketId} não encontrado`);
        return { success: false, reason: "Ticket not found" };
      }

      // Verificar se ainda está em status bot
      if (ticket.status !== "bot") {
        logger.info(`[InactivityTimeoutJob] Ticket ${ticketId} não está mais em status bot (${ticket.status}). Pulando.`);
        return { success: true, skipped: true, reason: "Status changed" };
      }

      // Buscar agente
      const agent = await AIAgent.findByPk(agentId);
      if (!agent || agent.status !== "active") {
        logger.warn(`[InactivityTimeoutJob] Agente ${agentId} não encontrado ou inativo`);
        return { success: false, reason: "Agent not found or inactive" };
      }

      // Calcular tempo de inatividade
      const now = Date.now();
      const lastUpdate = new Date(ticket.updatedAt).getTime();
      const minutesInactive = Math.floor((now - lastUpdate) / (60 * 1000));
      const timeoutMinutes = agent.inactivityTimeoutMinutes || 0;

      // Verificar se realmente atingiu o timeout
      if (minutesInactive < timeoutMinutes) {
        logger.info(
          `[InactivityTimeoutJob] Ticket ${ticketId} ainda não atingiu timeout ` +
          `(${minutesInactive}min < ${timeoutMinutes}min). Pulando.`
        );
        return { success: true, skipped: true, reason: "Not timed out yet" };
      }

      logger.info(
        `[InactivityTimeoutJob] Ticket ${ticketId} inativo há ${minutesInactive}min ` +
        `(timeout: ${timeoutMinutes}min). Processando...`
      );

      // Enviar mensagem de timeout se configurada
      if (agent.inactivityMessage) {
        try {
          await sendTimeoutMessage(ticket, agent.inactivityMessage);
        } catch (err: any) {
          logger.error(`[InactivityTimeoutJob] Erro ao enviar mensagem: ${err.message}`);
        }
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
        logger.info(`[InactivityTimeoutJob] ✅ Ticket ${ticketId} transferido para fila`);
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
        logger.info(`[InactivityTimeoutJob] ✅ Ticket ${ticketId} fechado por inatividade`);
      }

      // Emitir evento de socket
      const io = getIO();
      io.to(`company-${ticket.companyId}-open`)
        .to(`company-${ticket.companyId}-${ticket.status}`)
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "update",
          ticket
        });

      return {
        success: true,
        ticketId,
        action: agent.inactivityAction,
        minutesInactive
      };

    } catch (error: any) {
      logger.error(
        `[InactivityTimeoutJob] ❌ Erro ao processar ticket ${ticketId}: ${error.message}`,
        { stack: error.stack }
      );
      throw error;
    }
  }
};

/**
 * Envia mensagem de timeout para o cliente
 */
async function sendTimeoutMessage(ticket: Ticket, message: string): Promise<void> {
  const wbot = await getWbot(ticket.whatsappId);
  const contact = await ticket.$get("contact");
  
  if (!contact) {
    logger.warn(`[InactivityTimeoutJob] Contato não encontrado para ticket ${ticket.id}`);
    return;
  }

  const jid = `${contact.number}@s.whatsapp.net`;
  
  // Verificar se é API Oficial ou Baileys
  if ((wbot as any).channelType === "official" || (wbot as any).isOfficial) {
    await (wbot as any).sendTextMessage(jid, message);
  } else {
    await wbot.sendMessage(jid, { text: message });
  }

  logger.info(`[InactivityTimeoutJob] Mensagem de timeout enviada para ticket ${ticket.id}`);
}
