import BullQueue from "bull";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import { FlowBuilderModel } from "../models/FlowBuilder";
import type { IConnections, INodes } from "../services/WebhookService/DispatchWebHookService";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";

/**
 * Fila de retomada de fluxos do FlowBuilder (nós assíncronos):
 * - smartDelay: retoma no próximo nó após amount*unit
 * - waitReply: retoma pela saída "b" (timeout de espera)
 *
 * Idempotência: o job carrega resumeToken e só executa se
 * ticket.dataWebhook.resumeToken === resumeToken. Se o usuário respondeu
 * antes (token limpo pelo listener) o job sai sem efeito.
 */
export const flowResumeQueue = new BullQueue("FlowResumeQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 }
  }
});

export interface FlowResumePayload {
  ticketId: number;
  companyId: number;
  resumeToken: string;
}

/** Agenda a retomada do fluxo — usado pelos executores (smartDelay/waitReply). */
export async function scheduleFlowResume(
  payload: FlowResumePayload,
  delayMs: number
): Promise<void> {
  await flowResumeQueue.add("FlowResume", payload, { delay: delayMs });
}

async function processFlowResume(job: any): Promise<void> {
  const { ticketId, companyId, resumeToken } = job.data as FlowResumePayload;

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: [{ model: Contact, as: "contact" }]
  });

  if (!ticket) {
    logger.warn(
      `[FlowResumeQueue] Ticket ${ticketId} não encontrado (company ${companyId})`
    );
    return;
  }

  const dw: any = ticket.dataWebhook || {};

  // Idempotência: o token precisa bater com o gravado — se o usuário
  // respondeu ou o fluxo andou, o job é descartado.
  if (!dw.resumeToken || dw.resumeToken !== resumeToken || !dw.resumeNodeId) {
    return;
  }

  if (!ticket.flowStopped) {
    logger.warn(
      `[FlowResumeQueue] Ticket ${ticketId} sem flowStopped — nada a retomar`
    );
    return;
  }

  const flowId = Number(ticket.flowStopped);
  const flow = await FlowBuilderModel.findOne({
    where: { id: flowId, company_id: companyId }
  });
  if (!flow) {
    logger.warn(
      `[FlowResumeQueue] Fluxo ${flowId} não encontrado — ticket ${ticketId}`
    );
    return;
  }

  const resumeNodeId = dw.resumeNodeId;
  const timeoutMessage = dw.resumeTimeoutMessage;

  // Limpa o estado de espera antes de retomar (invalida jobs do mesmo ciclo)
  const newDw: any = {
    ...dw,
    resumeToken: null,
    resumeNodeId: null,
    resumeTimeoutMessage: null
  };
  await ticket.update({ dataWebhook: newDw });

  const nodes: INodes[] = flow.flow["nodes"] || [];
  const connections: IConnections[] = flow.flow["connections"] || [];

  const mountDataContact = {
    number: ticket.contact?.number || "",
    name: ticket.contact?.name || "",
    email: ticket.contact?.email || ""
  };

  const isMetaChannel =
    ticket.channel === "facebook" || ticket.channel === "instagram";

  if (isMetaChannel) {
    const session = await Whatsapp.findOne({
      where: { id: ticket.whatsappId, companyId }
    });
    if (!session) {
      logger.warn(
        `[FlowResumeQueue] Conexão ${ticket.whatsappId} não encontrada — ticket ${ticketId}`
      );
      return;
    }
    if (timeoutMessage && ticket.contact?.number) {
      const { sendText } = await import(
        "../services/FacebookServices/graphAPI"
      );
      await sendText(
        ticket.contact.number,
        timeoutMessage,
        session.facebookUserToken
      );
    }
    const { ActionsWebhookFacebookService } = await import(
      "../services/FacebookServices/WebhookFacebookServices/ActionsWebhookFacebookService"
    );
    await ActionsWebhookFacebookService(
      session,
      flowId,
      companyId,
      nodes,
      connections,
      resumeNodeId,
      newDw,
      "",
      "",
      "",
      ticket.id,
      mountDataContact
    );
  } else {
    if (timeoutMessage) {
      const SendWhatsAppMessage = (
        await import("../services/WbotServices/SendWhatsAppMessage")
      ).default;
      await SendWhatsAppMessage({ body: timeoutMessage, ticket } as any);
    }
    const { ActionsWebhookService } = await import(
      "../services/WebhookService/ActionsWebhookService"
    );
    await ActionsWebhookService(
      ticket.whatsappId,
      flowId,
      companyId,
      nodes,
      connections,
      resumeNodeId,
      newDw,
      "",
      "",
      "",
      ticket.id,
      mountDataContact
    );
  }
}

/** Registra o processador — chamado em queues.ts:startQueueProcess() */
export function setupFlowResumeProcessors(): void {
  flowResumeQueue.process("FlowResume", 3, processFlowResume);
  logger.info("[FlowResumeQueue] Processadores configurados");
}

export default flowResumeQueue;
