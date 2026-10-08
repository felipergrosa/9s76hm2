import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import CreateLogTicketService from "./CreateLogTicketService";
import { emitTicketStatusChange } from "../../helpers/emitTicketUpdate";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import type {
  IConnections,
  INodes
} from "../WebhookService/DispatchWebHookService";
import logger from "../../utils/logger";

interface Request {
  ticketId: number | string;
  flowId: number;
  companyId: number;
  userId: number;
  force?: boolean;
}

/**
 * Disparo manual de fluxo do FlowBuilder ("Disparar Fluxo" no ticket).
 *
 * Coloca o ticket em modo bot (status "bot", sem atendente/fila) e executa
 * o fluxo a partir do nó inicial reutilizando o executor já existente
 * (ActionsWebhookService p/ WhatsApp, ActionsWebhookFacebookService p/ Meta).
 * O próprio executor regrava flowStopped/lastFlowId/flowWebhook conforme
 * itera — a retomada das respostas do contato segue o mecanismo já
 * existente no listener de mensagens.
 */
const TriggerFlowService = async ({
  ticketId,
  flowId,
  companyId,
  userId,
  force = false
}: Request): Promise<Ticket> => {
  // findOne direto (não ShowTicketService): evita os side-effects de
  // "abertura" — refresh de avatar e syncOnTicketOpen não se aplicam a um
  // disparo feito com o ticket já aberto na tela.
  const ticket = await Ticket.findOne({
    where: { id: Number(ticketId), companyId },
    include: [{ model: Contact, as: "contact" }]
  });
  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (ticket.status === "closed") {
    throw new AppError("ERR_TICKET_CLOSED", 400);
  }

  // Fluxo assume atendimento individual — nó "menu"/"question" fala com o
  // contato direto; grupos não têm número de contato válido para isso.
  if (ticket.isGroup) {
    throw new AppError("ERR_FLOW_NOT_ALLOWED_FOR_GROUP", 400);
  }

  // Ticket já executando um fluxo: exige confirmação explícita (force) para
  // não sobrescrever um chatbot em andamento sem o atendente saber.
  const alreadyInFlow =
    Boolean(ticket.flowStopped) &&
    (Boolean(ticket.flowWebhook) || Boolean(ticket.lastFlowId));
  if (alreadyInFlow && !force) {
    throw new AppError("ERR_TICKET_ALREADY_IN_FLOW", 409);
  }

  const parsedFlowId = Number(flowId);
  if (!Number.isInteger(parsedFlowId) || parsedFlowId <= 0) {
    throw new AppError("ERR_FLOW_INVALID_ID", 400);
  }

  const flow = await FlowBuilderModel.findOne({
    where: { id: parsedFlowId, company_id: companyId }
  });
  if (!flow) {
    throw new AppError("ERR_FLOW_NOT_FOUND", 404);
  }
  if (flow.active === false) {
    throw new AppError("ERR_FLOW_INACTIVE", 400);
  }

  const nodes: INodes[] = (flow.flow as any)?.nodes || [];
  const connections: IConnections[] = (flow.flow as any)?.connections || [];
  if (!nodes.length) {
    throw new AppError("ERR_FLOW_EMPTY", 400);
  }

  // Ponto de entrada: mesmo padrão dos gatilhos existentes (nodes[0], que o
  // builder grava como o bloco "Início"). Se a ordem divergir, prioriza o
  // nó do tipo "start".
  const startNode =
    nodes.find((node: any) => node.type === "start") || nodes[0];

  const channel = ticket.channel || "whatsapp";
  const isMetaChannel = channel === "facebook" || channel === "instagram";
  if (!isMetaChannel && channel !== "whatsapp") {
    throw new AppError("ERR_FLOW_CHANNEL_NOT_SUPPORTED", 400);
  }

  // Pré-valida a conexão: o executor retorna silenciosamente quando ela não
  // está CONNECTED — falhar aqui evita mover o ticket p/ a aba BOT sem
  // executar nada.
  let whatsappSession: Whatsapp | null = null;
  if (isMetaChannel) {
    whatsappSession = await Whatsapp.findOne({
      where: { id: ticket.whatsappId, companyId }
    });
    if (!whatsappSession) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }
  } else {
    whatsappSession = await GetDefaultWhatsApp(ticket.whatsappId, companyId);
    if (whatsappSession.status !== "CONNECTED") {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
    }
  }

  // Retomada de nós interativos (menu/webhook) passa por
  // handleMessageIntegration quando o ticket tem integrationId +
  // useIntegration. Herda a integração da conexão apenas quando ela é do
  // tipo "flowbuilder" — um typebot/n8n roubaria as respostas do fluxo.
  let flowIntegrationId: number | null = null;
  const candidateIntegrationIds = [ticket.integrationId];
  if (ticket.whatsappId) {
    const ticketWhatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId, companyId },
      attributes: ["id", "integrationId"]
    });
    candidateIntegrationIds.push(ticketWhatsapp?.integrationId);
  }
  for (const candidateId of candidateIntegrationIds) {
    if (!candidateId) continue;
    const integration = await QueueIntegrations.findOne({
      where: { id: candidateId, companyId },
      attributes: ["id", "type"]
    });
    if (integration?.type === "flowbuilder") {
      flowIntegrationId = integration.id;
      break;
    }
  }

  const oldStatus = ticket.status;
  await ticket.update({
    status: "bot",
    userId: null,
    queueId: null,
    isBot: true,
    // useIntegration=true mesmo sem integração: bloqueia verifyQueue
    // (saudação/filas) e o AIAgent de disputar mensagens com o fluxo.
    useIntegration: true,
    integrationId: flowIntegrationId,
    // Estado de fluxo zerado — o executor regrava ao iterar os nós.
    flowWebhook: false,
    lastFlowId: null,
    hashFlowId: null,
    flowStopped: null,
    dataWebhook: null
  });

  // Sai da aba anterior (ex.: open) e aparece na aba BOT em tempo real
  await emitTicketStatusChange(ticket, companyId, oldStatus);

  await CreateLogTicketService({
    type: "chatBot",
    ticketId: ticket.id,
    userId
  });

  const mountDataContact = {
    number: ticket.contact?.number || "",
    name: ticket.contact?.name || "",
    email: ticket.contact?.email || ""
  };

  try {
    if (isMetaChannel) {
      const { ActionsWebhookFacebookService } = await import(
        "../FacebookServices/WebhookFacebookServices/ActionsWebhookFacebookService"
      );
      await ActionsWebhookFacebookService(
        whatsappSession,
        parsedFlowId,
        companyId,
        nodes,
        connections,
        startNode.id,
        null,
        "",
        "",
        "",
        ticket.id,
        mountDataContact
      );
    } else {
      await ActionsWebhookService(
        ticket.whatsappId,
        parsedFlowId,
        companyId,
        nodes,
        connections,
        startNode.id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact
      );
    }
  } catch (err: any) {
    // O executor já loga internamente; repassa erro amigável ao atendente.
    logger.error(
      `[TriggerFlowService] Falha ao executar fluxo ${parsedFlowId} no ticket ${ticket.id}: ${err?.message || err}`
    );
    throw new AppError("ERR_FLOW_TRIGGER_FAILED", 500);
  }

  return ticket;
};

export default TriggerFlowService;
