import sequelize from "../../database";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

const ShowMessageService = async (messageId: string, companyId?: number) => {
  // Query parametrizada para evitar SQL Injection.
  // Quando companyId é informado, restringe a busca ao tenant (anti cross-tenant).
  const companyFilter = companyId ? `and "companyId" = :companyId` : "";
  const message = await sequelize.query(
    `select * from "Messages" where id = :messageId ${companyFilter}`,
    {
      replacements: { messageId, companyId },
      model: Message,
      mapToModel: true
    }
  );
  if (message.length > 0) {
    return message[0] as unknown as Message;
  }
  return undefined;
}

export const GetWhatsAppFromMessage = async (message: Message): Promise<number | null> => {
  const ticketId = message.ticketId;
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    return null;
  }
  return ticket.whatsappId;
}


export default ShowMessageService;
