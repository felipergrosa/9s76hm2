import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";

interface ClearTicketMessagesParams {
  ticketId: string | number;
  companyId: number;
}

interface ClearResult {
  deleted: number;
  success: boolean;
  error?: string;
}

/**
 * Remove todas as mensagens de um ticket, mantendo apenas o ticket
 * Permite sincronização completa do histórico do WhatsApp posteriormente
 */
const ClearTicketMessagesService = async ({
  ticketId,
  companyId
}: ClearTicketMessagesParams): Promise<ClearResult> => {
  try {
    // 1. Verificar se o ticket existe e pertence à empresa
    const ticket = await Ticket.findByPk(ticketId);
    
    if (!ticket) {
      return { deleted: 0, success: false, error: "Ticket não encontrado" };
    }

    if (ticket.companyId !== companyId) {
      return { deleted: 0, success: false, error: "Ticket não pertence a esta empresa" };
    }

    // 2. Contar mensagens antes de deletar
    const count = await Message.count({
      where: { ticketId, companyId }
    });

    if (count === 0) {
      return { deleted: 0, success: true, error: "Nenhuma mensagem para deletar" };
    }

    // 3. Deletar todas as mensagens do ticket
    const deleted = await Message.destroy({
      where: { ticketId, companyId }
    });

    logger.info(`[ClearTicketMessages] Deletadas ${deleted} mensagens do ticketId=${ticketId}`);

    // 4. Emitir evento para atualizar UI em tempo real
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket: { ...ticket.toJSON(), messageCount: 0 }
    });

    // 5. Emitir evento específico para limpar UI do chat
    io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-cleared`, {
      action: "messages_cleared",
      ticketId,
      deleted
    });

    return { deleted, success: true };

  } catch (err: any) {
    logger.error(`[ClearTicketMessages] Erro ao limpar mensagens: ${err?.message}`);
    return { deleted: 0, success: false, error: `Erro: ${err?.message}` };
  }
};

export default ClearTicketMessagesService;
