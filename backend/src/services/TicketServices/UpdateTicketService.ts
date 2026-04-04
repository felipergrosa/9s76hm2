import moment from "moment";
import * as Sentry from "@sentry/node";
import { Op } from "sequelize";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import { ticketEventBus } from "./TicketEventBus";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import { isNil } from "lodash";
import sendFaceMessage from "../FacebookServices/sendFacebookMessage";
import { verifyMessageFace } from "../FacebookServices/facebookMessageListener";
import ShowUserService from "../UserServices/ShowUserService";
import User from "../../models/User";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "./CreateLogTicketService";
import TicketTag from "../../models/TicketTag";
import Tag from "../../models/Tag";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "./FindOrCreateTicketService";
import formatBody from "../../helpers/Mustache";
import { Mutex } from "async-mutex";
import logger from "../../utils/logger";
import ApplyUserPersonalTagService from "../ContactServices/ApplyUserPersonalTagService";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  isBot?: boolean;
  queueOptionId?: number;
  sendFarewellMessage?: boolean;
  amountUsedBotQueues?: number;
  lastMessage?: string;
  integrationId?: number;
  useIntegration?: boolean;
  unreadMessages?: number;
  msgTransfer?: string;
  isTransfered?: boolean;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const shouldCreateNewTicketOnUserHandoff = ({
  ticket,
  oldUserId,
  nextUserId,
  nextStatus
}: {
  ticket: Ticket;
  oldUserId: number | undefined;
  nextUserId: number | null | undefined;
  nextStatus: string | undefined;
}): boolean => {
  if (ticket.isGroup) {
    return false;
  }

  if (isNil(oldUserId) || Number(oldUserId) === 0) {
    return false;
  }

  if (isNil(nextUserId) || Number(nextUserId) === 0) {
    return false;
  }

  if (Number(oldUserId) === Number(nextUserId)) {
    return false;
  }

  return nextStatus !== "closed";
};

const cloneTicketTags = async ({
  sourceTicketId,
  targetTicketId,
  companyId
}: {
  sourceTicketId: number;
  targetTicketId: number;
  companyId: number;
}): Promise<void> => {
  const currentTags = await TicketTag.findAll({
    where: {
      ticketId: sourceTicketId,
      companyId
    },
    attributes: ["tagId"]
  });

  if (!currentTags.length) {
    return;
  }

  await TicketTag.bulkCreate(
    currentTags.map(ticketTag => ({
      ticketId: targetTicketId,
      tagId: ticketTag.tagId,
      companyId
    }))
  );
};

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId
}: Request): Promise<Response> => {
  try {
    let {
      queueId,
      userId,
      sendFarewellMessage = true,
      amountUsedBotQueues,
      lastMessage,
      integrationId,
      useIntegration,
      unreadMessages,
      msgTransfer,
      isTransfered = false,
      status
    } = ticketData;
    let isBot: boolean | null = ticketData.isBot || false;
    let queueOptionId: number | null = ticketData.queueOptionId || null;

    const io = getIO();

    const settings = await CompaniesSettings.findOne({
      where: {
        companyId: companyId
      }
    });

    let ticket = await ShowTicketService(ticketId, companyId);

    if (ticket.channel === "whatsapp" && ticket.whatsappId) {
      await SetTicketMessagesAsRead(ticket);
    }

    const oldStatus = ticket?.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket?.queueId;

    // Se um atendente está assumindo um ticket que está em BOT,
    // mover para OPEN e desligar modo bot para não ficar preso na aba BOT.
    const isAssigningUser = !isNil(userId) && userId !== 0;
    if (
      isAssigningUser &&
      oldStatus === "bot" &&
      (status === undefined || status === "bot" || status === "pending")
    ) {
      status = "open";
      isBot = false;
      (ticketData as any).isBot = false;
    }

    if (isNil(ticket.whatsappId) && status === "closed") {
      await CreateLogTicketService({
        userId,
        queueId: ticket.queueId,
        ticketId,
        type: "closed"
      });

      await ticket.update({
        status: "closed"
      });

      // CQRS: Emitir evento via TicketEventBus
      ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);
      logger.debug(`[UpdateTicketService] CQRS delete emitido (whatsappId null, closed) ticket=${ticket.id}`)
      return { ticket, oldStatus, oldUserId };
    }

    if (oldStatus === "closed") {
      logger.debug(`[UpdateTicketService] Reabrindo ticket fechado ${ticketId}`)
      let otherTicket = await Ticket.findOne({
        where: {
          contactId: ticket.contactId,
          status: { [Op.or]: ["open", "pending", "group"] },
          whatsappId: ticket.whatsappId
        }
      });
      if (otherTicket) {
        if (otherTicket.id !== ticket.id) {
          otherTicket = await ShowTicketService(otherTicket.id, companyId)
          return { ticket: otherTicket, oldStatus, oldUserId }
        }
      }

      // await CheckContactOpenTickets(ticket.contactId, ticket.whatsappId );
      isBot = false;
    }

    let queue;
    if (!isNil(queueId)) {
      queue = await Queue.findByPk(queueId);
    }

    const nextStatus = status ?? ticket.status;
    if (
      shouldCreateNewTicketOnUserHandoff({
        ticket,
        oldUserId,
        nextUserId: userId,
        nextStatus
      })
    ) {
      const targetQueueId = !isNil(queueId) ? Number(queueId) : ticket.queueId;
      const targetStatus = nextStatus || "open";
      const targetLastMessage = lastMessage || ticket.lastMessage;
      const targetUnreadMessages = !isNil(unreadMessages)
        ? Number(unreadMessages)
        : Number(ticket.unreadMessages || 0);

      let currentTracking = null;
      if (oldStatus !== "closed") {
        currentTracking = await FindOrCreateATicketTrakingService({
          ticketId,
          companyId,
          whatsappId: ticket?.whatsappId,
          userId: oldUserId,
          queueId: oldQueueId
        });
      }

      if (oldStatus !== "closed") {
        (ticket as any)._skipHookEmit = true;
        await ticket.update({
          status: "closed",
          unreadMessages: 0,
          lastFlowId: null,
          dataWebhook: null,
          hashFlowId: null
        });

        ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);
      }

      if (currentTracking) {
        await currentTracking.update({
          finishedAt: moment().toDate(),
          closedAt: moment().toDate(),
          whatsappId: ticket.whatsappId,
          userId: ticket.userId,
          queueId: ticket.queueId
        });
      }

      let newTicketTransfer = await FindOrCreateTicketService(
        ticket.contact,
        ticket.whatsapp,
        targetUnreadMessages,
        ticket.companyId,
        targetQueueId,
        userId,
        null,
        ticket.channel,
        false,
        false,
        settings,
        true
      );

      await cloneTicketTags({
        sourceTicketId: ticket.id,
        targetTicketId: newTicketTransfer.id,
        companyId: ticket.companyId
      });

      if (!isNil(msgTransfer)) {
        const messageData = {
          wid: `PVT${newTicketTransfer.updatedAt.toString().replace(' ', '')}`,
          ticketId: newTicketTransfer.id,
          contactId: newTicketTransfer.contactId,
          body: msgTransfer,
          fromMe: true,
          mediaType: 'extendedTextMessage',
          read: true,
          quotedMsgId: null,
          ack: 2,
          remoteJid: newTicketTransfer.contact?.remoteJid,
          participant: null,
          dataJson: null,
          ticketTrakingId: null,
          isPrivate: true
        };

        await CreateMessageService({ messageData, companyId: ticket.companyId });
      }

      await newTicketTransfer.update({
        queueId: targetQueueId,
        userId,
        status: targetStatus,
        isBot: false,
        queueOptionId,
        amountUsedBotQueues: targetStatus === "closed"
          ? 0
          : amountUsedBotQueues
            ? amountUsedBotQueues
            : newTicketTransfer.amountUsedBotQueues,
        lastMessage: targetLastMessage,
        useIntegration,
        integrationId,
        unreadMessages: targetUnreadMessages
      });

      newTicketTransfer = await ShowTicketService(newTicketTransfer.id, companyId);

      const newTicketTracking = await FindOrCreateATicketTrakingService({
        ticketId: newTicketTransfer.id,
        companyId,
        whatsappId: newTicketTransfer.whatsappId,
        userId,
        queueId: targetQueueId
      });

      await newTicketTracking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId: newTicketTransfer.whatsappId,
        userId: newTicketTransfer.userId,
        queueId: newTicketTransfer.queueId
      });

      if (isTransfered && settings.sendMsgTransfTicket === "enabled" && settings.transferMessage && settings.transferMessage.trim() !== "") {
        if ((oldQueueId !== targetQueueId || oldUserId !== userId) && !isNil(oldQueueId) && !isNil(targetQueueId) && ticket.whatsapp?.status === 'CONNECTED') {
          const wbot = await GetTicketWbot(newTicketTransfer);
          const msgtxt = formatBody(`\u200e ${settings.transferMessage.replace("${queue.name}", queue?.name)}`, newTicketTransfer);
          const queueChangedMessage = await wbot.sendMessage(
            `${newTicketTransfer.contact.number}@${newTicketTransfer.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: msgtxt
            }
          );
          await verifyMessage(queueChangedMessage, newTicketTransfer, newTicketTransfer.contact, newTicketTracking);
        }
      }

      await CreateLogTicketService({
        userId: oldUserId,
        queueId: oldQueueId,
        ticketId,
        type: "transfered"
      });
      await CreateLogTicketService({
        userId,
        queueId: targetQueueId || oldQueueId,
        ticketId: newTicketTransfer.id,
        type: "receivedTransfer"
      });

      ticketEventBus.publishTicketUpdated(companyId, newTicketTransfer.id, newTicketTransfer.uuid, newTicketTransfer);

      if (userId && ticket.contactId) {
        await ApplyUserPersonalTagService({
          contactId: ticket.contactId,
          userId,
          companyId
        });
      }

      return { ticket: newTicketTransfer, oldStatus, oldUserId };
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket?.whatsappId
    });
    // console.log("GETTING WHATSAPP UPDATE TICKETSERVICE", ticket?.whatsappId)
    const { complationMessage, ratingMessage, groupAsTicket } = await ShowWhatsAppService(
      ticket?.whatsappId,

      companyId
    );

    if (status !== undefined && ["closed"].indexOf(status) > -1) {

      const _userId = ticket.userId || userId;
      let user
      if (_userId) {
        user = await User.findByPk(_userId);
      }

      if (settings.userRating === "enabled" &&
        (sendFarewellMessage || sendFarewellMessage === undefined) &&
        (!isNil(ratingMessage) && ratingMessage !== "") &&
        !ticket.isGroup) {

        if (ticketTraking.ratingAt == null) {

          const ratingTxt = ratingMessage || "";
          let bodyRatingMessage = `\u200e ${ratingTxt}\n`;

          if (ticket.channel === "whatsapp" && ticket.whatsapp.status === 'CONNECTED') {
            const msg = await SendWhatsAppMessage({ body: bodyRatingMessage, ticket, isForwarded: false });
            await verifyMessage(msg, ticket, ticket.contact);

          }

          if (["facebook", "instagram"].includes(ticket.channel)) {

            const msg = await sendFaceMessage({ body: bodyRatingMessage, ticket });
            await verifyMessageFace(msg, bodyRatingMessage, ticket, ticket.contact);
          }

          await ticketTraking.update({
            userId: ticket.userId,
            closedAt: moment().toDate()
          });

          await CreateLogTicketService({
            userId: ticket.userId,
            queueId: ticket.queueId,
            ticketId,
            type: "nps"
          });

          // try {
          //   // Retrieve tagIds associated with the provided ticketId from TicketTags
          //   const ticketTags = await TicketTag.findAll({ where: { ticketId } });
          //   const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);

          //   // Find the tagIds with kanban = 1 in the Tags table
          //   const tagsWithKanbanOne = await Tag.findAll({
          //     where: {
          //       id: tagIds,
          //       kanban: 1,
          //     },
          //   });

          //   // Remove the tagIds with kanban = 1 from TicketTags
          //   const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
          //   if (tagIdsWithKanbanOne)
          //     await TicketTag.destroy({ where: { ticketId, tagId: tagIdsWithKanbanOne } });
          // } catch (error) {
          //   Sentry.captureException(error);
          // }

          await ticket.update({
            status: "nps",
            amountUsedBotQueuesNPS: 1
          })

          // CQRS: Emitir evento via TicketEventBus
          ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);

          logger.debug(`[UpdateTicketService] CQRS delete emitido (NPS) ticket=${ticket.id}`)
          return { ticket, oldStatus, oldUserId };

        }
      }

    // Grupos NUNCA são fechados
      if (!ticket.isGroup) {
        // Primeiro atualiza o status para closed
        await ticket.update({
          status: "closed",
          lastFlowId: null,
          dataWebhook: null,
          hashFlowId: null,
        });

        // Emitir evento IMEDIATAMENTE após o update para garantir real-time
        ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);
        logger.debug(`[UpdateTicketService] CQRS delete emitido IMEDIATAMENTE (closed) ticket=${ticket.id}`);

        // Salvar informações de tracking e log
        ticketTraking.finishedAt = moment().toDate();
        ticketTraking.closedAt = moment().toDate();
        ticketTraking.whatsappId = ticket?.whatsappId;
        ticketTraking.userId = ticket.userId;

        // Loga fim de atendimento
        await CreateLogTicketService({
          userId,
          queueId: ticket.queueId,
          ticketId,
          type: "closed"
        });

        await ticketTraking.save();

        // Depois envia mensagem de despedida (se aplicável)
        if (((!isNil(user?.farewellMessage) && user?.farewellMessage !== "") ||
            (!isNil(complationMessage) && complationMessage !== "")) &&
            (sendFarewellMessage || sendFarewellMessage === undefined)) {

          let body: any

          if ((ticket.status !== 'pending') || (ticket.status === 'pending' && settings.sendFarewellWaitingTicket === 'enabled')) {
            if (!isNil(user) && !isNil(user?.farewellMessage) && user?.farewellMessage !== "") {
              body = `\u200e ${user.farewellMessage}`;
            } else {
              body = `\u200e ${complationMessage}`;
            }
            if (ticket.channel === "whatsapp" && (!ticket.isGroup || groupAsTicket === "enabled") && ticket.whatsapp.status === 'CONNECTED') {
              try {
                const sentMessage = await SendWhatsAppMessage({ body, ticket, isForwarded: false });
                await verifyMessage(sentMessage, ticket, ticket.contact);
                logger.debug(`[UpdateTicketService] Mensagem de despedida enviada com sucesso ticket=${ticket.id}`);
              } catch (err) {
                logger.error(`[UpdateTicketService] Erro ao enviar mensagem de despedida ticket=${ticket.id}:`, err);
                // Não falha o fechamento do ticket se a mensagem de despedida falhar
              }
            }

            if (["facebook", "instagram"].includes(ticket.channel) && (!ticket.isGroup || groupAsTicket === "enabled")) {
              try {
                const sentMessage = await sendFaceMessage({ body, ticket });
                logger.debug(`[UpdateTicketService] Mensagem de despedida Facebook/Instagram enviada ticket=${ticket.id}`);
              } catch (err) {
                logger.error(`[UpdateTicketService] Erro ao enviar mensagem de despedida Facebook/Instagram ticket=${ticket.id}:`, err);
                // Não falha o fechamento do ticket se a mensagem de despedida falhar
              }
            }
          }
        }
      } else {
        logger.info(`[UpdateTicketService] Grupo ${ticket.id} - fechamento ignorado, grupo permanece aberto`);
      }
      return { ticket, oldStatus, oldUserId };
    }
    if (!isNil(queueId)) {
      ticketTraking.queuedAt = moment().toDate();
    }

    if (isTransfered) {
      if (settings.closeTicketOnTransfer) {
        let newTicketTransfer = ticket;
        const oldTicketId = ticket.id; // Guardar ID do ticket antigo para migrar mensagens
        if (oldQueueId !== queueId) {
          await ticket.update({
            status: "closed"
          });

          await ticket.reload();

          // CQRS: Emitir delete com oldStatus para frontend filtrar por aba
          ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);

          newTicketTransfer = await FindOrCreateTicketService(
            ticket.contact,
            ticket.whatsapp,
            1,
            ticket.companyId,
            queueId,
            userId,
            null,
            ticket.channel, false, false, settings, isTransfered);

          await FindOrCreateATicketTrakingService({ ticketId: newTicketTransfer.id, companyId, whatsappId: ticket.whatsapp.id, userId });

          // =================================================================
          // MIGRAÇÃO DE HISTÓRICO: Transferir mensagens do ticket antigo para o novo
          // =================================================================
          // Isso garante que o novo atendente tenha acesso ao histórico da conversa
          const Message = (await import("../../models/Message")).default;
          const migratedCount = await Message.update(
            { ticketId: newTicketTransfer.id },
            { 
              where: { 
                ticketId: oldTicketId,
                companyId: ticket.companyId 
              } 
            }
          );
          logger.info(`[UpdateTicketService] Migradas ${migratedCount[0]} mensagens do ticket ${oldTicketId} para ${newTicketTransfer.id}`);
          // =================================================================
        }

        if (!isNil(msgTransfer)) {
          const messageData = {
            wid: `PVT${newTicketTransfer.updatedAt.toString().replace(' ', '')}`,
            ticketId: newTicketTransfer.id,
            contactId: newTicketTransfer.contactId, // SEMPRE usar contactId do ticket (nunca undefined)
            body: msgTransfer,
            fromMe: true,
            mediaType: 'extendedTextMessage',
            read: true,
            quotedMsgId: null,
            ack: 2,
            remoteJid: newTicketTransfer.contact?.remoteJid,
            participant: null,
            dataJson: null,
            ticketTrakingId: null,
            isPrivate: true
          };

          await CreateMessageService({ messageData, companyId: ticket.companyId });
        }

        await newTicketTransfer.update({
          queueId,
          userId,
          status
        })



        // Recarregar com todas as associações para emissão Socket.IO completa
        newTicketTransfer = await ShowTicketService(newTicketTransfer.id, companyId);

        if (settings.sendMsgTransfTicket === "enabled" && settings.transferMessage && settings.transferMessage.trim() !== "") {
          // Mensagem de transferencia da FILA
          if ((oldQueueId !== queueId || oldUserId !== userId) && !isNil(oldQueueId) && !isNil(queueId) && ticket.whatsapp.status === 'CONNECTED') {

            const wbot = await GetTicketWbot(ticket);
            const msgtxt = formatBody(`\u200e ${settings.transferMessage.replace("${queue.name}", queue?.name)}`, ticket);
            // const msgtxt = `\u200e *Mensagem Automática*:\nVocê foi transferido(a) para o departamento *${queue?.name}"*\nAguarde um momento, iremos atende-lo(a)!`;
            const queueChangedMessage = await wbot.sendMessage(
              `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: msgtxt
              }
            );
            await verifyMessage(queueChangedMessage, ticket, ticket.contact, ticketTraking);
          }
          // else
          //   // Mensagem de transferencia do ATENDENTE
          //   if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId) && (!ticket.isGroup || groupAsTicket === "enabled")) {
          //     const wbot = await GetTicketWbot(ticket);
          //     const nome = await ShowUserService(ticketData.userId, companyId);
          //     const msgtxt = `\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o atendente *${nome.name}*\nAguarde um momento, iremos atende-lo(a)!`;

          //     const queueChangedMessage = await wbot.sendMessage(
          //       `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //       {
          //         text: msgtxt
          //       }
          //     );
          //     await verifyMessage(queueChangedMessage, ticket, ticket.contact, ticketTraking);
          //   }
          //   else
          //     // Mensagem de transferencia do ATENDENTE e da FILA
          //     if (oldUserId !== userId && oldQueueId !== queueId && !isNil(oldUserId) && !isNil(userId) && (!ticket.isGroup || groupAsTicket === "enabled")) {
          //       const wbot = await GetTicketWbot(ticket);
          //       const nome = await ShowUserService(ticketData.userId, companyId);
          //       const msgtxt = `\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o departamento *${queue?.name}* e será atendido por *${nome.name}*\nAguarde um momento, iremos atende-lo(a)!`;

          //       const queueChangedMessage = await wbot.sendMessage(
          //         `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //         {
          //           text: msgtxt
          //         }
          //       );
          //       await verifyMessage(queueChangedMessage, ticket, ticket.contact);
          //     } else
          //       if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {

          //         const wbot = await GetTicketWbot(ticket);
          //         const msgtxt = "\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o departamento *" + queue?.name + "*\nAguarde um momento, iremos atende-lo(a)!";

          //         const queueChangedMessage = await wbot.sendMessage(
          //           `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //           {
          //             text: msgtxt
          //           }
          //         );
          //         await verifyMessage(queueChangedMessage, ticket, ticket.contact);
          //       }
        }

        // BUG-9 fix: Removida condicao duplicada (else if identico ao if)
        if (oldUserId !== userId && !isNil(oldUserId) && !isNil(userId)) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
          await CreateLogTicketService({
            userId,
            queueId: queueId || oldQueueId,
            ticketId: newTicketTransfer.id,
            type: "receivedTransfer"
          });
        } else if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        }

        if (newTicketTransfer.status !== oldStatus || newTicketTransfer.user?.id !== oldUserId) {
          await ticketTraking.update({
            userId: newTicketTransfer.userId
          })
          // CQRS: Emitir delete com oldStatus para frontend filtrar por aba
          ticketEventBus.publishTicketDeleted(companyId, newTicketTransfer.id, newTicketTransfer.uuid, oldStatus);
        }

        // CQRS: Emitir update via TicketEventBus
        ticketEventBus.publishTicketUpdated(companyId, newTicketTransfer.id, newTicketTransfer.uuid, newTicketTransfer);

        return { ticket: newTicketTransfer, oldStatus, oldUserId };

      } else {
        if (settings.sendMsgTransfTicket === "enabled" && settings.transferMessage && settings.transferMessage.trim() !== "") {
          // Mensagem de transferencia da FILA
          // BUG-10 fix: Corrigir precedencia de operador (|| vs &&)
          if ((oldQueueId !== queueId || oldUserId !== userId) && !isNil(oldQueueId) && !isNil(queueId) && ticket.whatsapp.status === 'CONNECTED') {

            const wbot = await GetTicketWbot(ticket);
            const msgtxt = formatBody(`\u200e ${settings.transferMessage.replace("${queue.name}", queue?.name)}`, ticket);
            // const msgtxt = `\u200e *Mensagem Automática*:\nVocê foi transferido(a) para o departamento *${queue?.name}"*\nAguarde um momento, iremos atende-lo(a)!`;

            const queueChangedMessage = await wbot.sendMessage(
              `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: msgtxt
              }
            );
            await verifyMessage(queueChangedMessage, ticket, ticket.contact, ticketTraking);
          }
          // else
          //   // Mensagem de transferencia do ATENDENTE
          //   if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId) && (!ticket.isGroup || groupAsTicket === "enabled")) {
          //     const wbot = await GetTicketWbot(ticket);
          //     const nome = await ShowUserService(ticketData.userId, companyId);
          //     const msgtxt = `\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o atendente *${nome.name}*\nAguarde um momento, iremos atende-lo(a)!`;

          //     const queueChangedMessage = await wbot.sendMessage(
          //       `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //       {
          //         text: msgtxt
          //       }
          //     );
          //     await verifyMessage(queueChangedMessage, ticket, ticket.contact, ticketTraking);
          //   }
          //   else
          //     // Mensagem de transferencia do ATENDENTE e da FILA
          //     if (oldUserId !== userId && oldQueueId !== queueId && !isNil(oldUserId) && !isNil(userId) && (!ticket.isGroup || groupAsTicket === "enabled")) {
          //       const wbot = await GetTicketWbot(ticket);
          //       const nome = await ShowUserService(ticketData.userId, companyId);
          //       const msgtxt = `\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o departamento *${queue?.name}* e será atendido por *${nome.name}*\nAguarde um momento, iremos atende-lo(a)!`;

          //       const queueChangedMessage = await wbot.sendMessage(
          //         `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //         {
          //           text: msgtxt
          //         }
          //       );
          //       await verifyMessage(queueChangedMessage, ticket, ticket.contact);
          //     } else
          //       if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {

          //         const wbot = await GetTicketWbot(ticket);
          //         const msgtxt = "\u200e*Mensagem Automática*:\nVocê foi transferido(a) para o departamento *" + queue?.name + "*\nAguarde um momento, iremos atende-lo(a)!";

          //         const queueChangedMessage = await wbot.sendMessage(
          //           `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          //           {
          //             text: msgtxt
          //           }
          //         );
          //         await verifyMessage(queueChangedMessage, ticket, ticket.contact);
          //       }
        }

        if (!isNil(msgTransfer)) {
          const messageData = {
            wid: `PVT${ticket.updatedAt.toString().replace(' ', '')}`,
            ticketId: ticket.id,
            contactId: ticket.contactId, // SEMPRE usar contactId do ticket (nunca undefined)
            body: msgTransfer,
            fromMe: true,
            mediaType: 'extendedTextMessage',
            read: true,
            quotedMsgId: null,
            ack: 2,
            remoteJid: ticket.contact?.remoteJid,
            participant: null,
            dataJson: null,
            ticketTrakingId: null,
            isPrivate: true
          };

          await CreateMessageService({ messageData, companyId: ticket.companyId });
        }

        // BUG-9 fix: Removida condicao duplicada (else if identico ao if)
        if (oldUserId !== userId && !isNil(oldUserId) && !isNil(userId)) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
          await CreateLogTicketService({
            userId,
            queueId: queueId || oldQueueId,
            ticketId: ticket.id,
            type: "receivedTransfer"
          });
        } else if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        }

        // if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
        //   await ticketTraking.update({
        //     userId: ticket.userId
        //   })

        //   io.to(oldStatus).emit(`company-${companyId}-ticket`, {
        //     action: "delete",
        //     ticketId: ticket.id
        //   });
        // }

        // io.to(ticket.status)
        //   .to("notification")
        //   .to(ticket.id.toString())
        //   .emit(`company-${companyId}-ticket`, {
        //     action: "update",
        //     ticket: ticket
        //   });

        // return { ticket, oldStatus, oldUserId };
      }
    }

    status = queue && queue.closeTicket && !ticket.isGroup ? "closed" : status;

    // Flag para evitar evento duplicado do ModelHook (emissão manual via ticketEventBus abaixo)
    (ticket as any)._skipHookEmit = true;
    
    await ticket.update({
      status,
      queueId,
      userId,
      isBot,
      queueOptionId,
      amountUsedBotQueues: status === "closed" ? 0 : amountUsedBotQueues ? amountUsedBotQueues : ticket.amountUsedBotQueues,
      lastMessage: lastMessage ? lastMessage : ticket.lastMessage,
      useIntegration,
      integrationId,
      typebotSessionId: !useIntegration ? null : ticket.typebotSessionId,
      typebotStatus: useIntegration,
      unreadMessages
    });

    ticketTraking.queuedAt = moment().toDate();
    ticketTraking.queueId = queueId;

    // Recarrega ticket com todas as associações para emitir evento Socket.IO completo
    ticket = await ShowTicketService(ticket.id, companyId);

    if (status !== undefined && ["pending"].indexOf(status) > -1) {
      //ticket voltou para fila
      await CreateLogTicketService({
        userId: oldUserId,
        ticketId,
        type: "pending"
      });

      await ticketTraking.update({
        whatsappId: ticket.whatsappId,
        startedAt: null,
        userId: null
      });
    }

    if (status !== undefined && ["open"].indexOf(status) > -1) {
      await ticketTraking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId,
        queueId: ticket.queueId
      });

      //loga inicio de atendimento
      await CreateLogTicketService({
        userId: userId,
        queueId: ticket.queueId,
        ticketId,
        type: oldStatus === "pending" ? "open" : "reopen"
      });
    } // adicionado fechamento do bloco if

    await ticketTraking.save();

    if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId || ticket.queueId !== oldQueueId) {
      // CQRS: Emitir evento de delete via TicketEventBus
      ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);
    }

    // CQRS: Emitir evento de update via TicketEventBus
    ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);

    // Auto-tag: aplica tag pessoal do novo usuário ao contato quando transferido
    if (userId && oldUserId !== userId && ticket.contactId) {
      await ApplyUserPersonalTagService({
        contactId: ticket.contactId,
        userId: userId,
        companyId
      });
    }

    return { ticket, oldStatus, oldUserId };
  } catch (err) {
    logger.error(`[UpdateTicketService] Erro ao atualizar ticket ${ticketId}`, { ticketData })
    Sentry.captureException(err);
    throw err; // Relança o erro para que o controller possa tratá-lo adequadamente
  }
};

export default UpdateTicketService;
