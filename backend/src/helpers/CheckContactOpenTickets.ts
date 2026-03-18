import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Queue from "../models/Queue";
import Contact from "../models/Contact";
import Tag from "../models/Tag";

const CheckContactOpenTickets = async (
  contactId: number,
  whatsappId: number,
  companyId: number,
  requestUserId?: number
): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { contactId, whatsappId, companyId, status: { [Op.or]: ["open", "pending"] } },
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
    ]
  });

  if (!ticket) {
    return; // Sem ticket aberto, pode criar
  }

  // Se não informou requestUserId, lança erro genérico
  if (!requestUserId) {
    const ticketInfo = JSON.stringify({
      id: ticket.id,
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
      queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
    });
    throw new AppError(ticketInfo);
  }

  // Buscar usuário que está tentando criar o ticket
  const requestUser = await User.findByPk(requestUserId, {
    attributes: ["id", "profile", "super", "allowedContactTags", "managedUserIds"]
  });

  if (!requestUser) {
    throw new AppError("Usuário não encontrado", 404);
  }

  // Admin e Super sempre podem assumir
  if (requestUser.profile === "admin" || requestUser.super) {
    const ticketInfo = JSON.stringify({
      id: ticket.id,
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
      queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
    });
    throw new AppError(ticketInfo);
  }

  // Se é o próprio ticket do usuário, pode assumir
  if (ticket.userId === requestUserId) {
    const ticketInfo = JSON.stringify({
      id: ticket.id,
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
      queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
    });
    throw new AppError(ticketInfo);
  }

  // Verificar se gerencia o usuário do ticket
  const managedIds = (requestUser.managedUserIds || []).map(id => Number(id));
  if (managedIds.includes(Number(ticket.userId))) {
    const ticketInfo = JSON.stringify({
      id: ticket.id,
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
      queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
    });
    throw new AppError(ticketInfo);
  }

  // Verificar se o contato tem as tags/carteiras do usuário
  const contact = await Contact.findByPk(contactId, {
    include: ["tags", "wallets"]
  });

  if (contact) {
    const userAllowedTags = requestUser.allowedContactTags || [];
    const contactTagIds = (contact as any).tags?.map((t: any) => t.id) || [];
    const contactWalletIds = (contact as any).wallets?.map((w: any) => w.id) || [];

    // Se usuário tem tags permitidas, verificar se contato tem PELO MENOS UMA delas
    if (userAllowedTags.length > 0) {
      const hasAnyTag = userAllowedTags.some(tagId => 
        contactTagIds.includes(tagId) || contactWalletIds.includes(tagId)
      );

      if (hasAnyTag) {
        // Contato tem pelo menos uma tag/carteira do usuário, pode assumir
        const ticketInfo = JSON.stringify({
          id: ticket.id,
          status: ticket.status,
          userId: ticket.userId,
          user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
          queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
        });
        throw new AppError(ticketInfo);
      }
    }
  }

  // Sem permissão: bloqueia criação sem mostrar modal
  throw new AppError("ERR_OTHER_OPEN_TICKET");
};

export default CheckContactOpenTickets;
