import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import CreateLogTicketService from "./CreateLogTicketService";

const DeleteTicketService = async (id: string, userId: string, companyId: number): Promise<Ticket> => {
  // Segurança: sempre filtrar por empresa para evitar exclusão cross-tenant
  const ticket = await Ticket.findOne({
    where: { id, companyId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await ticket.destroy();

  return ticket;
};

export default DeleteTicketService;
