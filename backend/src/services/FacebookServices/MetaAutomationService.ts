import { Op } from "sequelize";
import MetaAutomationRule from "../../models/MetaAutomationRule";
import metaAutomationQueue from "../../queues/MetaAutomationQueue";
import logger from "../../utils/logger";

/**
 * Evento normalizado de engajamento Meta (comentário, menção, referral, DM).
 * Produzido pelos listeners de webhook FB/IG e casado contra as regras
 * MetaAutomationRule — o envio efetivo acontece na MetaAutomationQueue.
 */
export interface MetaAutomationEvent {
  companyId: number;
  whatsappId: number;
  channel: string; // "facebook" | "instagram"
  trigger:
    | "comment_keyword"
    | "comment_any"
    | "story_mention"
    | "referral_ref"
    | "dm_keyword";
  commentText?: string;
  commentId?: string;
  postId?: string;
  mediaId?: string;
  username?: string;
  senderId?: string;
  ref?: string;
  dmText?: string; // para dm_keyword, o texto da DM recebida
}

// Dedupe em memória: não dispara a mesma regra 2x para o mesmo
// senderId+commentId dentro de 1h (webhooks Meta podem reentregar eventos).
const DEDUPE_TTL_MS = 60 * 60 * 1000;
const dispatched = new Map<string, number>();

const dedupeKey = (ruleId: number, evt: MetaAutomationEvent): string =>
  [
    ruleId,
    evt.senderId || "",
    evt.commentId || evt.mediaId || evt.postId || evt.ref || ""
  ].join(":");

const pruneDedupe = (): void => {
  const now = Date.now();
  for (const [key, expiresAt] of dispatched) {
    if (expiresAt <= now) dispatched.delete(key);
  }
};

// matchValue puramente numérico é tratado como id de post/media da Meta
// (filtro por post específico); qualquer outro valor é keyword de texto.
const isNumericId = (value: string): boolean => /^\d+$/.test(value);

/**
 * Match de regra:
 * - comment_keyword: matchValue numérico → casa se evt.postId/mediaId ===
 *   matchValue (regra "nesse post"). matchValue texto → keyword contida em
 *   commentText (case-insensitive). O formato composto "postId:keyword" NÃO
 *   é suportado nesta fundação — filtrar por post usa matchValue numérico.
 * - comment_any / story_mention: matchValue vazio casa sempre; se preenchido
 *   numérico, filtra pelo post/media do evento.
 * - referral_ref: matchValue vazio casa sempre; preenchido exige === evt.ref.
 * - dm_keyword: keyword contida em evt.dmText (case-insensitive).
 */
const matchesRule = (
  rule: MetaAutomationRule,
  evt: MetaAutomationEvent
): boolean => {
  const mv = (rule.matchValue || "").trim();

  switch (rule.trigger) {
    case "comment_keyword": {
      if (!mv) return true;
      if (isNumericId(mv)) {
        const target = evt.mediaId || evt.postId;
        return !!target && String(target) === mv;
      }
      const text = (evt.commentText || "").toLowerCase();
      return text.includes(mv.toLowerCase());
    }

    case "comment_any":
    case "story_mention": {
      if (!mv) return true;
      // matchValue preenchido restringe a regra a um post/media específico
      if (isNumericId(mv)) {
        const target = evt.mediaId || evt.postId;
        return !!target && String(target) === mv;
      }
      return true;
    }

    case "referral_ref": {
      if (!mv) return true;
      return mv === evt.ref;
    }

    case "dm_keyword": {
      if (!mv) return true;
      return (evt.dmText || "").toLowerCase().includes(mv.toLowerCase());
    }

    default:
      return false;
  }
};

/**
 * Ponto de entrada: chamado pelos listeners de webhook Meta. Encontra as
 * regras ativas que casam com o evento e enfileira o disparo — NUNCA envia
 * inline (rate limit de private replies da Meta é ~200/h).
 */
export const processMetaAutomationEvent = async (
  evt: MetaAutomationEvent
): Promise<void> => {
  if (!evt?.companyId || !evt?.whatsappId || !evt?.trigger) return;

  try {
    const rules = await MetaAutomationRule.findAll({
      where: {
        companyId: evt.companyId,
        whatsappId: evt.whatsappId,
        active: true,
        trigger: evt.trigger,
        channel: { [Op.in]: [evt.channel, "both"] }
      }
    });

    if (!rules.length) return;

    pruneDedupe();

    for (const rule of rules) {
      if (!matchesRule(rule, evt)) continue;

      const key = dedupeKey(rule.id, evt);
      if (dispatched.has(key)) continue;
      dispatched.set(key, Date.now() + DEDUPE_TTL_MS);

      await rule.increment("sentCount");
      await rule.update({ lastTriggeredAt: new Date() });

      await metaAutomationQueue.add("MetaAutomationDispatch", {
        ruleId: rule.id,
        evt
      });
    }
  } catch (error: any) {
    // Nunca propagar: roda no caminho do webhook — falha aqui não pode
    // derrubar o processamento da mensagem principal.
    logger.error(
      `[MetaAutomation] Falha ao processar evento ${evt.trigger} ` +
        `(company=${evt.companyId} whatsapp=${evt.whatsappId}): ${error?.message || error}`
    );
  }
};

export default processMetaAutomationEvent;
