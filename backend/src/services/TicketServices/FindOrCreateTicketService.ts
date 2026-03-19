import { Op } from "sequelize";
import { sub } from "date-fns";
import { v5 as uuidv5 } from "uuid";

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
import { ticketEventBus } from "./TicketEventBus";

// Namespace fixo para gerar UUIDs v5 determinísticos para selfchat
const SELFCHAT_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

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
  isCampaign: boolean = false,
  isFromMe: boolean = false,
  isSelfChat: boolean = false
): Promise<Ticket> => {
  // try {
  // let isCreated = false;

  settings = settings ?? (await CompaniesSettings.findOne({ where: { companyId } })) ?? ({} as any);

  let openAsLGPD = false;
  if (settings && settings.enableLGPD) { // adicionar lgpdMessage

    openAsLGPD = !isCampaign &&
      !isTransfered &&
      settings.enableLGPD === "enabled" &&
      settings.lgpdMessage !== "" &&
      (settings.lgpdConsent === "enabled" ||
        (settings.lgpdConsent === "disabled" && (!contact || isNil(contact?.lgpdAcceptedAt))));
  }

  const io = getIO();

  const DirectTicketsToWallets = settings?.DirectTicketsToWallets;

  // =================================================================
  // SELFCHAT: Usar sempre o mesmo ticket com UUID determinístico
  // =================================================================
  if (isSelfChat) {
    // UUID v5 determinístico: mesmo input gera sempre o mesmo UUID válido
    const selfChatNumber = contact?.number || whatsapp?.number || "selfchat";
    const selfChatSeed = `selfchat-${selfChatNumber}-${companyId}`;
    const selfChatUuid = uuidv5(selfChatSeed, SELFCHAT_UUID_NAMESPACE);

    // Buscar ticket existente pelo UUID determinístico
    let ticket = await Ticket.findOne({
      where: {
        uuid: selfChatUuid,
        companyId
      }
    });

    // Fallback: buscar por contactId (para tickets criados antes desta correção)
    if (!ticket) {
      ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          whatsappId: whatsapp.id,
          isGroup: false
        },
        order: [["id", "DESC"]]
      });

      // Se encontrou ticket antigo, atualizar o UUID para o formato válido
      if (ticket) {
        (ticket as any)._skipHookEmit = true; // Evitar evento duplicado
        await ticket.update({ uuid: selfChatUuid, unreadMessages });
        ticket = await ShowTicketService(ticket.id, companyId);
        // Emitir evento de atualização para real-time
        ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
        logger.info(`[FindOrCreateTicket] Selfchat ticket migrado: id=${ticket.id}, uuid=${selfChatUuid}`);
        return ticket;
      }
    }

    if (ticket) {
      // Atualizar ticket existente
      (ticket as any)._skipHookEmit = true; // Evitar evento duplicado
      await ticket.update({ unreadMessages });
      ticket = await ShowTicketService(ticket.id, companyId);
      // Emitir evento de atualização para real-time
      ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
      logger.info(`[FindOrCreateTicket] Selfchat ticket reutilizado: id=${ticket.id}, uuid=${ticket.uuid}`);
      return ticket;
    }

    // Criar novo ticket selfchat com UUID válido
    ticket = await Ticket.create({
      uuid: selfChatUuid,
      status: "open",
      contactId: contact.id,
      companyId,
      whatsappId: whatsapp.id,
      isGroup: false,
      unreadMessages: 0,
      lastMessage: ""
    });

    ticket = await ShowTicketService(ticket.id, companyId);
    // Emitir evento de criação para real-time
    ticketEventBus.publishTicketCreated(companyId, ticket.id, ticket.uuid, ticket);

    logger.info(`[FindOrCreateTicket] Selfchat ticket criado: id=${ticket.id}, uuid=${selfChatUuid}`);
    return ticket;
  }
  // =================================================================

  // Para GRUPOS: buscar ticket mais recente independente de status (incluindo closed)
  // Isso garante que um grupo WhatsApp = um único ticket para sempre
  let ticket: Ticket | null = null;

  if (groupContact) {
    // Buscar por contactId+companyId (sem whatsappId) para encontrar tickets antigos com whatsappId null
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        companyId,
        isGroup: true
      },
      order: [["id", "DESC"]]
    });

    if (ticket) {
      // Atualizar whatsappId se estava null ou diferente
      const updates: any = { unreadMessages };
      const oldStatus = ticket.status;
      if (!ticket.whatsappId || ticket.whatsappId !== whatsapp.id) {
        updates.whatsappId = whatsapp.id;
        logger.info(`[FindOrCreateTicket] Grupo ticket ${ticket.id}: atualizando whatsappId ${ticket.whatsappId} -> ${whatsapp.id}`);
      }
      // Se encontrou ticket fechado ou com status incorreto (lgpd, etc), reabrir como "group"
      if (ticket.status === "closed" || ticket.status === "lgpd" || ticket.status === "nps" || ticket.status === "bot" || ticket.status === "pending") {
        updates.status = "group";
        logger.info(`[FindOrCreateTicket] Reabrindo ticket de grupo ${ticket.id} (estava ${ticket.status})`);
      }
      (ticket as any)._skipHookEmit = true; // Evitar evento duplicado
      await ticket.update(updates);
      ticket = await ShowTicketService(ticket.id, companyId);
      // Emitir evento de atualização para real-time
      if (updates.status && updates.status !== oldStatus) {
        ticketEventBus.publishStatusChanged(companyId, ticket.id, ticket.uuid, ticket, oldStatus, updates.status);
      } else {
        ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
      }
      return ticket;
    }
  } else {
    // Para contatos individuais: buscar ticket ABERTO mais recente
    // Tickets fechados permanecem fechados - novo ciclo = novo ticket
    ticket = await Ticket.findOne({
      where: {
        contactId: contact?.id,
        companyId,
        whatsappId: whatsapp.id,
        status: { [Op.notIn]: ["closed"] } // Ignorar tickets fechados
      },
      order: [["id", "DESC"]]
    });
    
    if (ticket) {
      logger.info(`[FindOrCreateTicket] Ticket aberto encontrado: ${ticket.id} (status=${ticket.status}, userId=${ticket.userId}, queueId=${ticket.queueId})`);
    } else {
      logger.info(`[FindOrCreateTicket] Nenhum ticket aberto encontrado para contactId=${contact?.id}. Será criado novo ticket.`);
    }
  }

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
      if (ticket.status === "pending" && !isFromMe) {
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
          const oldStatus = ticket.status;
          (ticket as any)._skipHookEmit = true; // Evitar evento duplicado
          await ticket.update({
            status: "bot",
            isBot: true,
            queueId: firstQueue.id
          });
          logger.info(
            `[FindOrCreateTicket] Ticket ${ticket.id} atualizado para bot (fila ${firstQueue.id})`
          );
          // Emitir evento de mudança de status para real-time
          ticketEventBus.publishStatusChanged(companyId, ticket.id, ticket.uuid, ticket, oldStatus, "bot");
        }
      }
    }

    ticket = await ShowTicketService(ticket.id, companyId);
    // Emitir evento de atualização para real-time (quando ticket foi encontrado e atualizado)
    // Nota: se houve mudança de status, já foi emitido acima
    if (ticket.status !== "closed") {
      ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
    }

    if (!isCampaign && !isForward) {
      // @ts-ignore: Unreachable code error
      if ((Number(ticket?.userId) !== Number(userId) && userId !== 0 && userId !== "" && userId !== "0" && !isNil(userId) && !ticket.isGroup)
        // @ts-ignore: Unreachable code error 
        || (queueId !== 0 && Number(ticket?.queueId) !== Number(queueId) && queueId !== "" && queueId !== "0" && !isNil(queueId))) {
        throw new AppError(
          JSON.stringify({
            id: ticket.id,
            uuid: ticket.uuid,
            userId: ticket.userId,
            status: ticket.status,
            user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
            queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null
          })
        );
      }
    }

    // isCreated = true;

    return ticket

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

    if (!isImported && !isNil(settings?.enableLGPD) && openAsLGPD && !groupContact) {
      initialStatus = "lgpd";
    } else if (groupContact) {
      // Grupos SEMPRE vão para a aba "grupo", independente do groupAsTicket
      initialStatus = "group";
    } else if (!groupContact && hasBotInDefaultQueue && !isFromMe) {
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
      queueId: initialQueueId,
      channel,
      imported: isImported ? new Date() : null,
      isActiveDemand: false,
    };

    if (DirectTicketsToWallets && contact?.id && !groupContact) {
      // NOVO: Smart Routing por Tags Pessoais (migração Wallet→Tag)
      const walletOwners = await contact.getWalletOwners();

      if (walletOwners && walletOwners.length > 0) {
        // Buscar primeiro usuário online
        const onlineOwner = walletOwners.find(u => u.online);

        if (onlineOwner) {
          ticketData.status = (!isImported && !isNil(settings?.enableLGPD)
            && openAsLGPD) ?
            "lgpd" : "open";
          ticketData.userId = onlineOwner.id;
          logger.info(`[SmartRouting-Tags] Ticket atribuído a usuário ONLINE: ${onlineOwner.name} (${onlineOwner.id})`);
        } else {
          ticketData.status = "pending";
          ticketData.userId = null;
          const ownerNames = walletOwners.map(u => u.name).join(", ");
          logger.info(`[SmartRouting-Tags] Donos [${ownerNames}] estão OFFLINE. Ticket mantido PENDING.`);
        }
      }
    }

    ticket = await Ticket.create(ticketData);
    // Emitir evento de criação para real-time
    ticketEventBus.publishTicketCreated(companyId, ticket.id, ticket.uuid, ticket);

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
        status: ticket.status === "pending" ? (!isFromMe && hasBot ? "bot" : "pending") : ticket.status,
        isBot: !isFromMe && hasBot
      });
    } else {
      await ticket.update({ queueId: queueId });
    }
  }

  if (userId != 0 && !isNil(userId)) {
    //Determina qual o atendente desse ticket.
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