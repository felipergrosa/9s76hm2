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

  let openAsLGPD = false;
  if (settings && settings.enableLGPD) { // adicionar lgpdMessage

    openAsLGPD = !isCampaign &&
      !isTransfered &&
      settings.enableLGPD === "enabled" &&
      settings.lgpdMessage !== "" &&
      (settings.lgpdConsent === "enabled" ||
        (settings.lgpdConsent === "disabled" && isNil(contact?.lgpdAcceptedAt)));
  }

  const io = getIO();

  const DirectTicketsToWallets = settings?.DirectTicketsToWallets;

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
      // Não forçar isBot: false! Manter estado atual do bot
      // Se ticket está em "bot", continua bot. Se está em "pending", continua pending.
      logger.info(`[FindOrCreateTicket] Ticket ${ticket.id} encontrado: status=${ticket.status}, queueId=${ticket.queueId}, isBot=${ticket.isBot}`);
      await ticket.update({ unreadMessages });
      
      // Se ticket está "pending", verificar se conexão tem fila com bot agora
      if (ticket.status === "pending") {
        logger.info(
          `[FindOrCreateTicket] Ticket ${ticket.id} está pending (queueId=${ticket.queueId}), verificando se deve virar bot...`
        );

        const Queue = (await import("../../models/Queue")).default;
        const Chatbot = (await import("../../models/Chatbot")).default;
        const Prompt = (await import("../../models/Prompt")).default;

        let firstQueue: any = null;

        if (ticket.queueId) {
          // Ticket já tem fila: usar a própria fila do ticket
          firstQueue = await Queue.findByPk(ticket.queueId, {
            include: [
              { model: Chatbot, as: "chatbots", attributes: ["id"] },
              { model: Prompt, as: "prompt", attributes: ["id"] }
            ]
          });
          logger.info(
            `[FindOrCreateTicket] Ticket ${ticket.id} já possui fila ${ticket.queueId}, verificando se fila tem bot/prompt...`
          );
        } else {
          // Ticket sem fila: buscar filas da conexão
          const whatsappWithQueues = await Whatsapp.findByPk(whatsapp.id, {
            include: [
              {
                model: Queue,
                as: "queues",
                attributes: ["id", "name"],
                include: [
                  { model: Chatbot, as: "chatbots", attributes: ["id"] },
                  { model: Prompt, as: "prompt", attributes: ["id"] }
                ]
              }
            ],
            order: [["queues", "orderQueue", "ASC"]]
          });

          const hasQueues =
            whatsappWithQueues?.queues && whatsappWithQueues.queues.length > 0;
          firstQueue = hasQueues ? whatsappWithQueues.queues[0] : null;

          // Fallback: se não houver associação em WhatsappQueues, usar fila de redirecionamento (sendIdQueue)
          if (!firstQueue && whatsappWithQueues?.sendIdQueue) {
            logger.info(
              `[FindOrCreateTicket] Conexão ${whatsapp.id} sem queues associadas, usando sendIdQueue=${whatsappWithQueues.sendIdQueue} como fila padrão`
            );
            firstQueue = await Queue.findByPk(whatsappWithQueues.sendIdQueue, {
              include: [
                { model: Chatbot, as: "chatbots", attributes: ["id"] },
                { model: Prompt, as: "prompt", attributes: ["id"] }
              ]
            });
          }
        }

        const hasChatbot = firstQueue?.chatbots && firstQueue.chatbots.length > 0;
        const hasPrompt = firstQueue?.prompt && firstQueue.prompt.length > 0;
        let hasAIAgentPending = false;
        if (firstQueue) {
          try {
            const AIAgent = (await import("../../models/AIAgent")).default;
            const aiAgent = await AIAgent.findOne({
              where: {
                companyId,
                status: "active"
              }
            });
            if (aiAgent && Array.isArray(aiAgent.queueIds) && aiAgent.queueIds.includes(firstQueue.id)) {
              hasAIAgentPending = true;
              logger.info(`[FindOrCreateTicket] AIAgent "${aiAgent.name}" encontrado para fila ${firstQueue.id} (ticket pending)`);
            }
          } catch (err) {
            logger.warn(`[FindOrCreateTicket] Erro ao verificar AIAgent (pending): ${err}`);
          }
        }

        const hasBotInDefaultQueuePending = hasChatbot || hasPrompt || hasAIAgentPending;

        if (hasBotInDefaultQueuePending) {
          // Atualizar ticket para bot se agora tem fila com bot configurado
          await ticket.update({
            status: "bot",
            isBot: true,
            queueId: firstQueue.id
          });
          logger.info(
            `[FindOrCreateTicket] Ticket ${ticket.id} atualizado para bot (fila ${firstQueue.id})`
          );
        }
      }
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
    const Prompt = (await import("../../models/Prompt")).default;

    const whatsappWithQueues = await Whatsapp.findByPk(whatsapp.id, {
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id", "name"],
          include: [
            {
              model: Chatbot,
              as: "chatbots",
              attributes: ["id", "name"]
            },
            {
              model: Prompt,
              as: "prompt",
              attributes: ["id", "name"]
            }
          ]
        }
      ],
      order: [["queues", "orderQueue", "ASC"]]
    });

    let firstQueue: any = null;
    const hasQueues =
      whatsappWithQueues?.queues && whatsappWithQueues.queues.length > 0;
    firstQueue = hasQueues ? whatsappWithQueues.queues[0] : null;

    // Fallback: se não houver associação em WhatsappQueues, usar fila de redirecionamento (sendIdQueue)
    if (!firstQueue && whatsappWithQueues?.sendIdQueue) {
      logger.info(
        `[FindOrCreateTicket] Conexão ${whatsapp.id} sem queues associadas, usando sendIdQueue=${whatsappWithQueues.sendIdQueue} como fila padrão (criação de ticket)`
      );
      firstQueue = await Queue.findByPk(whatsappWithQueues.sendIdQueue, {
        include: [
          { model: Chatbot, as: "chatbots", attributes: ["id", "name"] },
          { model: Prompt, as: "prompt", attributes: ["id", "name"] }
        ]
      });
    }

    // Verificar se conexão tem fila padrão com chatbot OU prompt (IA/RAG) OU AIAgent
    const hasChatbot = firstQueue?.chatbots && firstQueue.chatbots.length > 0;
    const hasPrompt = firstQueue?.prompt && firstQueue.prompt.length > 0;
    
    // Verificar se existe AIAgent ativo vinculado a esta fila
    let hasAIAgent = false;
    if (firstQueue) {
      try {
        const AIAgent = (await import("../../models/AIAgent")).default;
        const aiAgent = await AIAgent.findOne({
          where: {
            companyId,
            status: "active"
          }
        });
        // AIAgent armazena queueIds como array JSON
        if (aiAgent && Array.isArray(aiAgent.queueIds) && aiAgent.queueIds.includes(firstQueue.id)) {
          hasAIAgent = true;
          logger.info(`[FindOrCreateTicket] AIAgent "${aiAgent.name}" encontrado para fila ${firstQueue.id}`);
        }
      } catch (err) {
        logger.warn(`[FindOrCreateTicket] Erro ao verificar AIAgent: ${err}`);
      }
    }
    
    const hasBotInDefaultQueue = hasChatbot || hasPrompt || hasAIAgent;
    
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
    // Buscar fila com chatbots E prompts para verificar se deve ativar bot
    const Queue = (await import("../../models/Queue")).default;
    const Chatbot = (await import("../../models/Chatbot")).default;
    const Prompt = (await import("../../models/Prompt")).default;
    
    const queue = await Queue.findByPk(queueId, {
      include: [
        { 
          model: Chatbot, 
          as: "chatbots",
          attributes: ["id", "name"]
        },
        {
          model: Prompt,
          as: "prompt",
          attributes: ["id", "name"]
        }
      ]
    });
    
    if (queue) {
      const hasChatbot = queue.chatbots && queue.chatbots.length > 0;
      const hasPrompt = queue.prompt && queue.prompt.length > 0;
      const hasBot = hasChatbot || hasPrompt;
      
      // Atualiza status para bot somente se fila tiver chatbot OU prompt configurado
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