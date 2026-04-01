import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Plan from "../../models/Plan";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import Company from "../../models/Company";
import QueueIntegrations from "../../models/QueueIntegrations";
import TicketTag from "../../models/TicketTag";
import ContactCustomField from "../../models/ContactCustomField";
import RefreshContactAvatarService from "../ContactServices/RefreshContactAvatarService";
import { queueImportHistory } from "../MessageServices/ImportHistoryQueue";
import logger from "../../utils/logger";
import GetUserPersonalTagContactIds from "../../helpers/GetUserPersonalTagContactIds";

// Throttle de atualização de avatar/nome por contato (24h)
const lastAvatarCheck = new Map<string, number>();
const lastTicketHistorySync = new Map<string, number>();

const ShowTicketService = async (
  id: string | number,
  companyId: number
): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: {
      id,
      companyId
    },
    attributes: [
      "id",
      "uuid",
      "queueId",
      "lastFlowId",
      "flowStopped",
      "dataWebhook",
      "flowWebhook",
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
      "typebotSessionId",
      "typebotStatus",
      "sendInactiveMessage",
      "queueId",
      "fromMe",
      "isOutOfHour",
      "isActiveDemand",
      "typebotSessionTime",
      "sessionWindowExpiresAt",
      "lastTemplateSentAt"
    ],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "companyId",
          "name",
          "number",
          "email",
          "profilePicUrl",
          "acceptAudioMessage",
          "active",
          "disableBot",
          "remoteJid",
          "urlPicture",
          "isGroup",
          "lgpdAcceptedAt",
          "cpfCnpj",
          "representativeCode",
          "city",
          "instagram",
          "situation",
          "segment",
          "fantasyName",
          "foundationDate",
          "creditLimit"
        ],
        include: [
          {
            model: ContactCustomField,
            as: "extraInfo"
          },
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
          }
        ]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"],
        include: ["chatbots"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "profileImage", "color"],
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color", "kanban"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "color", "groupAsTicket", "greetingMediaAttachment", "facebookUserToken", "facebookUserId", "status", "channelType"]

      },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"],
        include: [{
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "useKanban"]
        }]
      },
      {
        model: QueueIntegrations,
        as: "queueIntegration",
        attributes: ["id", "name"]
      },
      {
        model: TicketTag,
        as: "ticketTags",
        attributes: ["tagId"]
      }
    ]
  });

  if (ticket?.companyId !== companyId) {
    throw new AppError("Não é possível consultar registros de outra empresa");
  }

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Atualiza/baixa avatar automaticamente ao abrir o ticket (no máximo 1x a cada 24h por contato)
  // OTIMIZAÇÃO: Executar de forma ASSÍNCRONA para não bloquear abertura do ticket
  try {
    if (ticket.contactId) {
      const key = `${ticket.companyId}:${ticket.contactId}`;
      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      const last = lastAvatarCheck.get(key) || 0;

      if (now - last > DAY) {
        lastAvatarCheck.set(key, now); // Marcar ANTES para evitar múltiplas chamadas
        
        // Executar em background sem bloquear resposta
        RefreshContactAvatarService({ contactId: ticket.contactId, companyId, whatsappId: ticket.whatsappId })
          .catch((err: any) => {
            logger.debug(`[ShowTicket] Erro ao atualizar avatar em background: ${err?.message}`);
          });
        
        // NÃO fazer reload aqui - socket emitirá update quando avatar estiver pronto
      }
    }
  } catch (e) {
    // Evita falhar a abertura do ticket por erro no refresh de avatar
  }

  try {
    if (ticket.whatsappId && ticket.channel === "whatsapp") {
      const whatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
        attributes: ["id", "status", "syncOnTicketOpen", "channelType"]
      });

      if (whatsapp?.channelType === "official") {
        logger.debug(`[ShowTicket] Pulando syncOnTicketOpen para ticket ${ticket.id}: conexão API Oficial não usa histórico Baileys.`);
      } else if (whatsapp?.syncOnTicketOpen && whatsapp.status === "CONNECTED") {
        const throttleKey = `${companyId}:${ticket.id}`;
        const now = Date.now();
        const lastSyncAt = lastTicketHistorySync.get(throttleKey) || 0;

        if (now - lastSyncAt > 30000) {
          lastTicketHistorySync.set(throttleKey, now);

          // Adicionar à queue assíncrona (não bloqueia)
          queueImportHistory({
            ticketId: Number(id),
            companyId,
            periodMonths: 0,
            downloadMedia: false, // Lazy open não faz download de mídia por padrão
            requestedBy: "lazy_open"
          }).catch((err: any) => {
            logger.warn(`[ShowTicket] Erro ao adicionar importação à queue: ${err?.message}`);
          });
        }
      }
    }
  } catch (e) {
    logger.warn(`[ShowTicket] Falha ao iniciar sync on open: ${(e as Error)?.message || e}`);
  }

  return ticket;
};

export default ShowTicketService;