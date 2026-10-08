import BullQueue from "bull";
import axios from "axios";
import MetaAutomationRule from "../models/MetaAutomationRule";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import { FlowBuilderModel } from "../models/FlowBuilder";
import { replyToComment, sendText, sendAttachmentFromUrl, profilePsid } from "../services/FacebookServices/graphAPI";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import type { MetaAutomationEvent } from "../services/FacebookServices/MetaAutomationService";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";
const GRAPH = "https://graph.facebook.com/v19.0";
// A "Like Media and Comments API" do Instagram foi lançada pela Meta em
// abr/2026 e exige versão >= v26 do Graph — os demais endpoints seguem em v19.
const GRAPH_V26 = "https://graph.facebook.com/v26.0";

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
 * Auto-curtida no comentário que disparou a regra (paridade Fluxoo/ManyChat):
 * - Facebook: POST /{comment-id}/likes com page token (pages_manage_engagement)
 * - Instagram: POST /{ig-user-id}/likes { comment_id } — "Like Media and
 *   Comments API" (Meta, abr/2026). Exige instagram_manage_engagement e conta
 *   IG conectada via login do Facebook/página. Stories não suportados.
 * Best-effort: falha (permissão, versão, comentário privado) vira warn e NÃO
 * aborta o restante da automação.
 */
const likeComment = async (
  whatsapp: Whatsapp,
  evt: MetaAutomationEvent,
  token: string
): Promise<void> => {
  if (!evt.commentId) return;
  try {
    if (evt.channel === "instagram") {
      const igUserId = whatsapp.instagramAccountId;
      if (!igUserId) {
        logger.warn(
          `[MetaAutomationQueue][autoLike] Conexão ${whatsapp.id} sem instagramAccountId — like IG ignorado`
        );
        return;
      }
      await axios.post(
        `${GRAPH_V26}/${igUserId}/likes`,
        { comment_id: evt.commentId },
        { params: { access_token: token } }
      );
      return;
    }
    await axios.post(
      `${GRAPH}/${evt.commentId}/likes`,
      {},
      { params: { access_token: token } }
    );
  } catch (error: any) {
    logMetaError(`autoLike comment=${evt.commentId} channel=${evt.channel}`, error);
  }
};

/**
 * Check de seguidor:
 * - Instagram: GET /{igsid}?fields=is_user_follow_business — disponível para
 *   IGSID que interagiu com a conta (inclui remetente de comentário).
 * - Facebook: a Graph API NÃO expõe "usuário segue a página" → indeterminado.
 * Retorna true/false/null (null = indeterminado: sem senderId, canal sem
 * suporte ou erro Meta — ex.: código 230, que por privacidade não revela a
 * relação). Indeterminado é tratado como seguidor (fail-open): bloquear
 * nesses casos impediria a automação de comentaristas legítimos.
 */
const checkFollower = async (
  evt: MetaAutomationEvent,
  token: string
): Promise<boolean | null> => {
  if (!evt.senderId || evt.channel !== "instagram") return null;
  try {
    const { data } = await axios.get(`${GRAPH}/${evt.senderId}`, {
      params: { access_token: token, fields: "is_user_follow_business" }
    });
    if (typeof data?.is_user_follow_business === "boolean") {
      return data.is_user_follow_business;
    }
    return null;
  } catch (error: any) {
    logMetaError(`checkFollower sender=${evt.senderId}`, error);
    return null;
  }
};

// Texto padrão do pedido de follow quando a regra usa ask_follow sem texto
const DEFAULT_NON_FOLLOWER_TEXT =
  "Oi {{contact.name}}! Siga nosso perfil para receber o conteúdo. 😊";

// Monta o texto da DM: dmText interpolado + link da recompensa anexado
// (private reply de comentário só aceita texto — ver sendPrivateReply)
const buildDmText = (
  rule: MetaAutomationRule,
  evt: MetaAutomationEvent,
  withRewardLink: boolean
): string => {
  const text = interpolate(rule.dmText || "", evt).trim();
  if (!withRewardLink || !rule.rewardMediaUrl) return text;
  return [text, rule.rewardMediaUrl.trim()].filter(Boolean).join("\n\n");
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
    // 1. Auto-like no comentário (best-effort — não aborta a automação)
    if (rule.autoLikeComment && evt.commentId) {
      await likeComment(whatsapp, evt, token);
    }

    // 2. Check de seguidor — gate apenas de DM/fluxo (a resposta pública
    // continua independente). Indeterminado = fail-open (segue o fluxo).
    let isFollower: boolean | null = null;
    if (rule.requireFollower) {
      isFollower = await checkFollower(evt, token);
    }

    // 3. Resposta pública ao comentário
    if (rule.publicReplyText && evt.commentId) {
      await replyToComment(
        evt.commentId,
        interpolate(rule.publicReplyText, evt),
        token
      );
    }

    // Não-seguidor confirmado: "ask_follow" envia o pedido de follow no lugar
    // da DM principal; "skip" não envia nada. Ambos encerram sem fluxo.
    if (rule.requireFollower && isFollower === false) {
      if (rule.nonFollowerAction === "ask_follow") {
        const askText = interpolate(
          rule.nonFollowerText || DEFAULT_NON_FOLLOWER_TEXT,
          evt
        );
        if (evt.commentId) {
          await sendPrivateReply(evt.channel, evt.commentId, askText, token);
        } else if (evt.senderId) {
          await sendText(evt.senderId, askText, token);
        }
      }
      return;
    }

    // 4. DM: com comentário → private reply (1 única mensagem de texto — a
    // recompensa vai como link anexado); sem comentário (story_mention,
    // referral, dm_keyword) → janela de 24h: texto + attachment separado
    if (evt.commentId) {
      const text = buildDmText(rule, evt, true);
      if (text) {
        await sendPrivateReply(evt.channel, evt.commentId, text, token);
      }
    } else if (evt.senderId) {
      if (rule.dmText) {
        await sendText(evt.senderId, interpolate(rule.dmText, evt), token);
      }
      if (rule.rewardMediaUrl) {
        await sendAttachmentFromUrl(
          String(evt.senderId),
          rule.rewardMediaUrl.trim(),
          rule.rewardMediaType || "file",
          token
        );
      }
    }

    // 5. Fluxo FlowBuilder na DM
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
