import AppError from "../../errors/AppError";

import { Op } from "sequelize";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import GetDefaultWhatsAppByUser from "../../helpers/GetDefaultWhatsAppByUser";
import Ticket from "../../models/Ticket";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Queue from "../../models/Queue";
import User from "../../models/User";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";

import CreateLogTicketService from "./CreateLogTicketService";
import ShowTicketService from "./ShowTicketService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  whatsappId: string;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  companyId,
  whatsappId = ""
}: Request): Promise<Ticket> => {

  const io = getIO();

  let whatsapp;
  let defaultWhatsapp

  if (whatsappId !== "undefined" && whatsappId !== null && whatsappId !== "") {
    // console.log("GETTING WHATSAPP CREATE TICKETSERVICE", whatsappId)
    whatsapp = await ShowWhatsAppService(whatsappId, companyId)
  }


  defaultWhatsapp = await GetDefaultWhatsAppByUser(userId);

  if (whatsapp) {
    defaultWhatsapp = whatsapp;
  }
  if (!defaultWhatsapp)
    defaultWhatsapp = await GetDefaultWhatsApp(whatsapp.id, companyId);

  // console.log("defaultWhatsapp", defaultWhatsapp.id, defaultWhatsapp.channel)
  await CheckContactOpenTickets(contactId, defaultWhatsapp.id, companyId);

  const { isGroup } = await ShowContactService(contactId, companyId);

  // Lógica inteligente de bot: prioriza chatbot, fallback para RAG, desabilita se não tiver nenhum
  let shouldEnableBot = true;  // Default: bot ativo

  if (queueId) {
    const queue = await Queue.findByPk(queueId, {
      include: [
        {
          association: 'chatbots',
          required: false
        }
      ]
    });

    if (queue) {
      const hasChatbot = queue.chatbots && queue.chatbots.length > 0;
      const hasRAG = !!(queue.ragCollection && queue.ragCollection.trim());

      // Ativar bot SE tiver chatbot OU RAG
      shouldEnableBot = hasChatbot || hasRAG;

      console.log(`[CreateTicket] Fila ${queue.name}: chatbot=${hasChatbot}, RAG=${hasRAG}, isBot=${shouldEnableBot}`);
    }
  }

  let ticket = await Ticket.create({
    contactId,
    companyId,
    whatsappId: defaultWhatsapp.id,
    channel: defaultWhatsapp.channel,
    isGroup,
    userId,
    isBot: shouldEnableBot,  // Dinâmico baseado em chatbot OU RAG
    queueId,
    status: isGroup ? "group" : "open",
    isActiveDemand: true
  });

  // await Ticket.update(
  //   { companyId, queueId, userId, status: isGroup? "group": "open", isBot: true },
  //   { where: { id } }
  // );

  ticket = await ShowTicketService(ticket.id, companyId);

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  io.of(`/workspace-${companyId}`)
    // .to(ticket.status)
    // .to("notification")
    // .to(ticket.id.toString())
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

  await CreateLogTicketService({
    userId,
    queueId,
    ticketId: ticket.id,
    type: "create"
  });

  return ticket;
};

export default CreateTicketService;
