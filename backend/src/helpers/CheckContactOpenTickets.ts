import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Queue from "../models/Queue";

const CheckContactOpenTickets = async (contactId, whatsappId, companyId): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { contactId, whatsappId, companyId, status: { [Op.or]: ["open", "pending"] } },
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
    ]
  });

  if (ticket) {
    // Inclui informações do ticket para o frontend exibir quem está atendendo
    const ticketInfo = JSON.stringify({
      id: ticket.id,
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
      queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
    });
    throw new AppError(ticketInfo);
  }
};

export default CheckContactOpenTickets;
