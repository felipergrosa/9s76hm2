import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import Company from "../../models/Company";
import QueueIntegrations from "../../models/QueueIntegrations";

const ShowTicketUUIDService = async (uuid: string,
  companyId: number): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: {
      uuid,
      companyId
    },
    attributes: [
      "id",
      "uuid",
      "queueId",
      "isGroup",
      "channel",
      "status",
      "contactId",
      "useIntegration",
      "lastMessage",
      "updatedAt",
      "unreadMessages",
      "companyId",
      "whatsappId",
      "imported",
      "lgpdAcceptedAt",
      "amountUsedBotQueues",
      "useIntegration",
      "integrationId",
      "userId",
      "amountUsedBotQueuesNPS",
      "lgpdSendMessageAt",
      "isBot",
      "sessionWindowExpiresAt"
    ],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "name",
          "number",
          "email",
          "profilePicUrl",
          "acceptAudioMessage",
          "active",
          "disableBot",
          "urlPicture",
          "companyId",
          "isGroup",
          // Campos adicionais que o frontend precisa exibir
          "cpfCnpj",
          "representativeCode",
          "city",
          "instagram",
          "situation",
          "segment",
          "fantasyName",
          "foundationDate",
          "creditLimit",
          "remoteJid",
          "verificationCode"
        ],
        include: [
          "extraInfo",
          "tags"
        ]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color", "kanban"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "groupAsTicket", "greetingMediaAttachment", "facebookUserToken", "facebookUserId", "channelType"]
      },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"]
      },
      {
        model: QueueIntegrations,
        as: "queueIntegration",
        attributes: ["id", "name"]
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Self-healing da janela 24h (mesma lógica do ShowTicketService): a
  // janela é do par contato×conexão — replica a maior encontrada para este
  // ticket, evitando input bloqueado e badge "expirada" indevidos.
  if (ticket.whatsapp?.channelType === "official" && ticket.contactId && ticket.whatsappId) {
    try {
      const windowHolder = await Ticket.findOne({
        where: {
          companyId,
          contactId: ticket.contactId,
          whatsappId: ticket.whatsappId,
          sessionWindowExpiresAt: { [Op.ne]: null }
        },
        attributes: ["sessionWindowExpiresAt"],
        order: [["sessionWindowExpiresAt", "DESC"]]
      });

      const bestExpiresAt = windowHolder?.sessionWindowExpiresAt;
      const ownExpiresAt = ticket.sessionWindowExpiresAt;

      if (bestExpiresAt && (!ownExpiresAt || new Date(ownExpiresAt) < new Date(bestExpiresAt))) {
        await Ticket.update(
          { sessionWindowExpiresAt: bestExpiresAt },
          { where: { id: ticket.id, companyId } }
        );
        ticket.setDataValue("sessionWindowExpiresAt", bestExpiresAt);
      }
    } catch (e) {
      // Não impede a abertura do ticket se o backfill falhar
    }
  }

  return ticket;
};

export default ShowTicketUUIDService;
