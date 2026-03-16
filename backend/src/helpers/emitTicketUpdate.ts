import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { ticketEventBus } from "../services/TicketServices/TicketEventBus";
import logger from "../utils/logger";

/**
 * Emite eventos Socket.IO após atualização direta de ticket (ticket.update)
 * 
 * USO: Sempre que chamar ticket.update() diretamente (sem UpdateTicketService),
 * chamar esta função logo após para notificar o frontend.
 * 
 * @param ticket - Ticket atualizado (ou ID do ticket)
 * @param companyId - ID da empresa
 * @param oldStatus - Status anterior (necessário para emitir delete se mudou)
 * @param options - Opções adicionais
 */
export async function emitTicketUpdate(
  ticket: Ticket | number,
  companyId: number,
  oldStatus?: string,
  options: {
    skipDelete?: boolean; // Pular emissão de delete (quando status não mudou)
    skipUpdate?: boolean; // Pular emissão de update
    reload?: boolean; // Recarregar ticket com associações
  } = {}
): Promise<void> {
  const io = getIO();
  const { skipDelete = false, skipUpdate = false, reload = true } = options;

  try {
    // Se passou ID, buscar ticket
    let ticketData: Ticket;
    if (typeof ticket === "number") {
      ticketData = await ShowTicketService(ticket, companyId);
    } else {
      ticketData = reload 
        ? await ShowTicketService(ticket.id, companyId)
        : ticket;
    }

    const newStatus = ticketData.status;

    // Emitir delete se status mudou (para remover da aba antiga)
    if (!skipDelete && oldStatus && oldStatus !== newStatus) {
      ticketEventBus.publishTicketDeleted(
        companyId,
        ticketData.id,
        ticketData.uuid,
        oldStatus
      );
      logger.debug(`[emitTicketUpdate] Delete emitido: ticket=${ticketData.id} oldStatus=${oldStatus}`);
    }

    // Emitir update
    if (!skipUpdate) {
      ticketEventBus.publishTicketUpdated(
        companyId,
        ticketData.id,
        ticketData.uuid,
        ticketData
      );
      logger.debug(`[emitTicketUpdate] Update emitido: ticket=${ticketData.id} status=${newStatus}`);
    }
  } catch (err: any) {
    logger.error(`[emitTicketUpdate] Erro ao emitir eventos: ${err.message}`);
  }
}

/**
 * Emite apenas evento de update (para mudanças que não afetam status/aba)
 * Útil para: lastMessage, isOutOfHour, amountUsedBotQueues, etc.
 */
export async function emitTicketUpdateSimple(
  ticket: Ticket | number,
  companyId: number
): Promise<void> {
  return emitTicketUpdate(ticket, companyId, undefined, { 
    skipDelete: true, 
    reload: true 
  });
}

/**
 * Emite eventos quando ticket muda de status (inclui delete da aba antiga)
 * Útil para: status: "closed", status: "pending", etc.
 */
export async function emitTicketStatusChange(
  ticket: Ticket | number,
  companyId: number,
  oldStatus: string
): Promise<void> {
  return emitTicketUpdate(ticket, companyId, oldStatus, { reload: true });
}

export default emitTicketUpdate;
