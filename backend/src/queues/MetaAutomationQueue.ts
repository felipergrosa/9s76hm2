import BullQueue from "bull";
import axios from "axios";
import MetaAutomationRule from "../models/MetaAutomationRule";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import { FlowBuilderModel } from "../models/FlowBuilder";
import { replyToComment, sendText, profilePsid } from "../services/FacebookServices/graphAPI";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import type { MetaAutomationEvent } from "../services/FacebookServices/MetaAutomationService";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";
const GRAPH = "https://graph.facebook.com/v19.0";

/**
 * Fila de disparo das automações Meta (comentário→DM, menção, referral).
 * O enfileiramento acontece em MetaAutomationService.processMetaAutomationEvent;
 * aqui só executa o envio — rate limit de private replies da Meta é ~200/h.
 */
export const metaAutomationQueue = new BullQueue("MetaAutomationQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  }
});

interface MetaAutomationDispatchPayload {
  ruleId: number;
  evt: MetaAutomationEvent;
}

// {{contact.name}} → nome/username do remetente do evento
const interpolate = (text: string, evt: MetaAutomationEvent): string =>
  String(text || "").replace(
    /{{\s*contact\.name\s*}}/gi,
    evt.username || "cliente"
  );

// Log sanitizado de erro da Graph — error.config carrega access_token.
const logMetaError = (label: string, error: any): void => {
  const metaErr = error?.response?.data?.error;
  logger.warn(
    `[MetaAutomationQueue][${label}] ${metaErr?.message || error?.message || error} ` +
      `(code=${metaErr?.code ?? "n/a"} status=${error?.response?.status ?? "n/a"})`
  );
};

// Erros permanentes da Meta (permissão/token/janela) — retry não resolve.
const isPermanentMetaError = (error: any): boolean => {
  const code = Number(error?.response?.data?.error?.code);
  return [10, 190, 200, 230, 368].includes(code);
};

/**
 * Private reply a um comentário (mesmo contrato do CommentToDMService):
 * - Facebook: POST /{commentId}/private_replies
 * - Instagram: POST /me/messages com recipient { comment_id }
 */
const sendPrivateReply = async (
  channel: string,
  commentId: string,
  message: string,
  token: string
): Promise<void> => {
  if (channel === "instagram") {
    await axios.post(
      `${GRAPH}/me/messages`,
      {
        recipient: { comment_id: commentId },
        message: { text: message }
      },
      { params: { access_token: token } }
    );
    return;
  }
  await axios.post(
    `${GRAPH}/${commentId}/private_replies`,
    { message },
    { params: { access_token: token } }
  );
};

/**
 * Dispara um fluxo FlowBuilder na DM do remetente. Replica o pipeline do
 * facebookMessageListener: resolve perfil → contato → ticket → executor.
 */
async function dispatchFlow(
  rule: MetaAutomationRule,
  whatsapp: Whatsapp,
  evt: MetaAutomationEvent,
  token: string
): Promise<void> {
  const { companyId } = evt;

  const flow = await FlowBuilderModel.findOne({
    where: { id: rule.flowId, company_id: companyId }
  });
  if (!flow || !flow.active) {
    logger.warn(
      `[MetaAutomationQueue] Fluxo ${rule.flowId} inexistente/inativo — regra ${rule.id}`
    );
    return;
  }

  const nodes = (flow.flow as any)?.nodes || [];
  const connections = (flow.flow as any)?.connections || [];
  const startNodeId = nodes[0]?.id;
  if (!startNodeId) {
    logger.warn(
      `[MetaAutomationQueue] Fluxo ${rule.flowId} sem nó inicial — regra ${rule.id}`
    );
    return;
  }

  // Contato: reaproveita por número (PSID/IGSID) ou cria com o perfil Meta
  let contact = await Contact.findOne({
    where: { number: String(evt.senderId), companyId }
  });

  if (!contact) {
    const isIg = evt.channel === "instagram";
    const msgContact =
      (await profilePsid(evt.senderId, token, evt.channel)) || {};
    const resolvedName =
      msgContact?.name ||
      [msgContact?.first_name, msgContact?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      msgContact?.username ||
      evt.username ||
      `${isIg ? "Instagram" : "Facebook"} ${evt.senderId}`;

    contact = await CreateOrUpdateContactService({
      name: resolvedName,
      number: String(evt.senderId),
      profilePicUrl: msgContact?.profile_pic,
      isGroup: false,
      companyId,
      channels: [evt.channel],
      whatsappId: whatsapp.id,
      instagram: isIg ? msgContact?.username || evt.username : undefined
    });
  }

  if (!contact) {
    logger.warn(
      `[MetaAutomationQueue] Contato não resolvido (sender=${evt.senderId}) — regra ${rule.id}`
    );
    return;
  }

  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    0,
    companyId,
    0,
    0,
    null,
    evt.channel,
    null,
    false
  );

  await ticket.update({ dataWebhook: { status: "process" } });

  const dataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const { ActionsWebhookFacebookService } = await import(
    "../services/FacebookServices/WebhookFacebookServices/ActionsWebhookFacebookService"
  );

  await ActionsWebhookFacebookService(
    whatsapp,
    rule.flowId,
    companyId,
    nodes,
    connections,
    startNodeId,
    {},
    "",
    "",
    "",
    ticket.id,
    dataContact
  );
}

async function dispatchMetaAutomation(job: any): Promise<void> {
  const { ruleId, evt } = job.data as MetaAutomationDispatchPayload;

  const rule = await MetaAutomationRule.findOne({
    where: { id: ruleId, companyId: evt.companyId }
  });
  if (!rule || !rule.active) return;

  const whatsapp = await Whatsapp.findOne({
    where: { id: evt.whatsappId, companyId: evt.companyId }
  });
  const token = whatsapp?.metaPageAccessToken || whatsapp?.facebookUserToken;
  if (!whatsapp || !token) {
    logger.warn(
      `[MetaAutomationQueue] Conexão ${evt.whatsappId} sem token Meta — regra ${ruleId} ignorada`
    );
    return;
  }

  try {
    // Resposta pública ao comentário
    if (rule.publicReplyText && evt.commentId) {
      await replyToComment(
        evt.commentId,
        interpolate(rule.publicReplyText, evt),
        token
      );
    }

    // DM: com comentário → private reply; sem comentário (story_mention,
    // referral, dm_keyword) → sendText na janela de 24h aberta pelo evento
    if (rule.dmText) {
      const text = interpolate(rule.dmText, evt);
      if (evt.commentId) {
        await sendPrivateReply(evt.channel, evt.commentId, text, token);
      } else if (evt.senderId) {
        await sendText(evt.senderId, text, token);
      }
    }

    // Fluxo FlowBuilder na DM
    if (rule.flowId && evt.senderId) {
      await dispatchFlow(rule, whatsapp, evt, token);
    }
  } catch (error: any) {
    logMetaError(`rule=${ruleId} trigger=${evt.trigger}`, error);
    // Erro permanente da Meta → não adianta retry (consome attempts)
    if (isPermanentMetaError(error)) return;
    throw error;
  }
}

let processorsRegistered = false;

/** Registra o processador — chamado em queues.ts:startQueueProcess() */
export function setupMetaAutomationProcessors(): void {
  if (processorsRegistered) return;
  processorsRegistered = true;

  // ~200 private replies/h por página — limiter protege a cota Meta
  metaAutomationQueue.process(
    "MetaAutomationDispatch",
    {
      concurrency: 2,
      limiter: { max: 200, duration: 3600000 }
    },
    dispatchMetaAutomation
  );

  logger.info("[MetaAutomationQueue] Processadores configurados");
}

export default metaAutomationQueue;
