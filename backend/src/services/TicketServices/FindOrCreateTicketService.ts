import { Op } from "sequelize";
import { sub } from "date-fns";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import { isNil } from "lodash";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "./CreateLogTicketService";
import AppError from "../../errors/AppError";
import UpdateTicketService from "./UpdateTicketService";

// interface Response {
//   ticket: Ticket;
//   // isCreated: boolean;
// }

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsapp: Whatsapp,
  unreadMessages: number,
  companyId: number,
  queueId: number = null,
  userId: number = null,
  groupContact?: Contact,
  channel?: string,
  isImported?: boolean,
  isForward?: boolean,
  settings?: any,
  isTransfered?: boolean,
  isCampaign: boolean = false
): Promise<Ticket> => {
  // try {
  // let isCreated = false;

  let openAsLGPD = false
  if (settings.enableLGPD) { //adicionar lgpdMessage

    openAsLGPD = !isCampaign &&
      !isTransfered &&
      settings.enableLGPD === "enabled" &&
      settings.lgpdMessage !== "" &&
      (settings.lgpdConsent === "enabled" ||
        (settings.lgpdConsent === "disabled" && isNil(contact?.lgpdAcceptedAt)))
  }

  const io = getIO();

  const DirectTicketsToWallets = settings.DirectTicketsToWallets;

  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "group", "nps", "lgpd", "bot"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId: whatsapp.id
    },
    order: [["id", "DESC"]]
  });




  if (ticket) {
    if (isCampaign) {
      await ticket.update({
        userId: userId !== ticket.userId ? ticket.userId : userId,
        queueId: queueId !== ticket.queueId ? ticket.queueId : queueId,
      })
    } else {
      await ticket.update({ unreadMessages, isBot: false });
    }

    ticket = await ShowTicketService(ticket.id, companyId);
    // console.log(ticket.id)

    if (!isCampaign && !isForward) {
      // @ts-ignore: Unreachable code error
      if ((Number(ticket?.userId) !== Number(userId) && userId !== 0 && userId !== "" && userId !== "0" && !isNil(userId) && !ticket.isGroup)
        // @ts-ignore: Unreachable code error 
        || (queueId !== 0 && Number(ticket?.queueId) !== Number(queueId) && queueId !== "" && queueId !== "0" && !isNil(queueId))) {
        throw new AppError(`Ticket em outro atendimento. ${"Atendente: " + ticket?.user?.name} - ${"Fila: " + ticket?.queue?.name}`);
      }
    }

    // isCreated = true;

    return ticket

  }

  const timeCreateNewTicket = whatsapp.timeCreateNewTicket;

  if (!ticket && timeCreateNewTicket !== 0) {

    // @ts-ignore: Unreachable code error
    if (timeCreateNewTicket !== 0 && timeCreateNewTicket !== "0") {
      ticket = await Ticket.findOne({
        where: {
          updatedAt: {
            [Op.between]: [
              +sub(new Date(), {
                minutes: Number(timeCreateNewTicket)
              }),
              +new Date()
            ]
          },
          contactId: contact.id,
          companyId,
          whatsappId: whatsapp.id
        },
        order: [["updatedAt", "DESC"]]
      });
    }

    if (ticket && ticket.status !== "nps") {
      await ticket.update({
        status: "pending",
        unreadMessages,
        companyId,
        // queueId: timeCreateNewTicket === 0 ? null : ticket.queueId
      });
    }
  }

  if (!ticket) {
    // Buscar filas do whatsapp para verificar se deve iniciar como bot
    const Queue = (await import("../../models/Queue")).default;
    const Chatbot = (await import("../../models/Chatbot")).default;
    
    const whatsappWithQueues = await Whatsapp.findByPk(whatsapp.id, {
      include: [{
        model: Queue,
        as: "queues",
        attributes: ["id", "name"],
        include: [{
          model: Chatbot,
          as: "chatbots",
          attributes: ["id", "name"]
        }]
      }],
      order: [["queues", "orderQueue", "ASC"]]
    });
    
    // Verificar se conexão tem fila padrão com chatbot
    const hasQueues = whatsappWithQueues?.queues && whatsappWithQueues.queues.length > 0;
    const firstQueue = hasQueues ? whatsappWithQueues.queues[0] : null;
    const hasBotInDefaultQueue = firstQueue?.chatbots && firstQueue.chatbots.length > 0;
    
    // Determinar status inicial:
    // - Se é LGPD: "lgpd"
    // - Se é grupo: "group"
    // - Se conexão tem fila com bot: "bot" (atende automaticamente)
    // - Se conexão tem fila sem bot: "pending" MAS com fila atribuída
    // - Senão: "pending" sem fila
    let initialStatus = "pending";
    let initialIsBot = false;
    let initialQueueId = null;
    
    if (!isImported && !isNil(settings.enableLGPD) && openAsLGPD && !groupContact) {
      initialStatus = "lgpd";
    } else if (groupContact && whatsapp.groupAsTicket !== "enabled") {
      initialStatus = "group";
    } else if (!groupContact && hasBotInDefaultQueue) {
      // Conexão tem fila padrão COM bot: inicia como bot (vale para clientes novos E campanhas)
      initialStatus = "bot";
      initialIsBot = true;
      initialQueueId = firstQueue.id;
    } else if (!groupContact && firstQueue) {
      // Conexão tem fila padrão SEM bot: inicia como pending mas JÁ com fila atribuída
      initialStatus = "pending";
      initialIsBot = false;
      initialQueueId = firstQueue.id;
    }
    
    const ticketData: any = {
      contactId: groupContact ? groupContact.id : contact.id,
      status: initialStatus,
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId: whatsapp.id,
      companyId,
      isBot: initialIsBot,
      queueId: initialQueueId, // Atribui fila padrão se tem bot
      channel,
      imported: isImported ? new Date() : null,
      isActiveDemand: false,
    };

    if (DirectTicketsToWallets && contact.id) {
      const wallet: any = contact;
      const wallets = await wallet.getWallets();
      if (wallets && wallets[0]?.id) {
        ticketData.status = (!isImported && !isNil(settings.enableLGPD)
          && openAsLGPD && !groupContact) ? //verifica se lgpd está habilitada e não é grupo e se tem a mensagem e link da política
          "lgpd" :  //abre como LGPD caso habilitado parâmetro
          (whatsapp.groupAsTicket === "enabled" || !groupContact) ? // se lgpd estiver desabilitado, verifica se é para tratar ticket como grupo ou se é contato normal
            "open" : //caso  é para tratar grupo como ticket ou não é grupo, abre como pendente
            "group", // se não é para tratar grupo como ticket, vai direto para grupos
          ticketData.userId = wallets[0].id;
      }
    }

    ticket = await Ticket.create(
      ticketData
    );

    // await FindOrCreateATicketTrakingService({
    //   ticketId: ticket.id,
    //   companyId,
    //   whatsappId: whatsapp.id,
    //   userId: userId ? userId : ticket.userId
    // });
  }


  if (queueId != 0 && !isNil(queueId)) {
    //Determina qual a fila esse ticket pertence.
    // Buscar fila com chatbots para verificar se deve ativar bot
    const Queue = (await import("../../models/Queue")).default;
    const Chatbot = (await import("../../models/Chatbot")).default;
    
    const queue = await Queue.findByPk(queueId, {
      include: [{ 
        model: Chatbot, 
        as: "chatbots",
        attributes: ["id", "name"]
      }]
    });
    
    if (queue) {
      const hasBot = queue.chatbots && queue.chatbots.length > 0;
      
      // Atualiza status para bot somente se fila tiver chatbot configurado
      await ticket.update({ 
        queueId: queueId,
        status: ticket.status === "pending" ? (hasBot ? "bot" : "pending") : ticket.status,
        isBot: hasBot
      });
    } else {
      await ticket.update({ queueId: queueId });
    }
  }

  if (userId != 0 && !isNil(userId)) {
    //Determina qual a fila esse ticket pertence.
    await ticket.update({ userId: userId });
  }

  ticket = await ShowTicketService(ticket.id, companyId);

  await CreateLogTicketService({
    ticketId: ticket.id,
    type: openAsLGPD ? "lgpd" : "create"
  });


  return ticket;
};

export default FindOrCreateTicketService;