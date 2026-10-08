import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";

// Gatilhos suportados (estilo ManyChat): comentário, menção em story, referral, DM
export const VALID_TRIGGERS = [
  "comment_keyword",
  "comment_any",
  "story_mention",
  "referral_ref",
  "dm_keyword"
];

// Canais onde a regra pode escutar eventos
export const VALID_CHANNELS = ["facebook", "instagram", "both"];

// Ação para remetente que não é seguidor (requireFollower=true):
// "skip" = pula DM/fluxo | "ask_follow" = envia nonFollowerText pedindo follow
export const VALID_NON_FOLLOWER_ACTIONS = ["skip", "ask_follow"];

// Tipos de attachment aceitos pelo Send API da Meta para a mídia de recompensa
export const VALID_REWARD_MEDIA_TYPES = ["image", "video", "audio", "file"];

interface RuleData {
  name?: string;
  whatsappId?: number | null;
  channel?: string;
  trigger?: string;
  flowId?: number | null;
  nonFollowerAction?: string | null;
  nonFollowerText?: string | null;
  rewardMediaUrl?: string | null;
  rewardMediaType?: string | null;
}

/**
 * Validações de domínio compartilhadas entre Create e Update.
 * companyId vem sempre do token — nunca do payload.
 */
const ValidateRuleData = async (
  data: RuleData,
  companyId: number,
  isUpdate = false
): Promise<void> => {
  if (!isUpdate || data.name !== undefined) {
    if (!data.name || !String(data.name).trim()) {
      throw new AppError("Nome da automação é obrigatório", 400);
    }
  }

  if (data.trigger !== undefined && !VALID_TRIGGERS.includes(data.trigger)) {
    throw new AppError(
      `Gatilho inválido. Use: ${VALID_TRIGGERS.join(", ")}`,
      400
    );
  }

  if (data.channel !== undefined && !VALID_CHANNELS.includes(data.channel)) {
    throw new AppError(
      `Canal inválido. Use: ${VALID_CHANNELS.join(", ")}`,
      400
    );
  }

  // whatsappId precisa ser da empresa e ser conexão Meta (facebook|instagram)
  if (data.whatsappId !== undefined && data.whatsappId !== null) {
    const whatsapp = await Whatsapp.findOne({
      where: { id: data.whatsappId, companyId }
    });

    if (!whatsapp) {
      throw new AppError("Conexão não encontrada nesta empresa", 404);
    }

    if (!["facebook", "instagram"].includes(whatsapp.channel)) {
      throw new AppError(
        "A conexão precisa ser Facebook ou Instagram (Meta)",
        400
      );
    }
  }

  // flowId, se informado, precisa ser um fluxo FlowBuilder da empresa
  if (data.flowId !== undefined && data.flowId !== null) {
    const flow = await FlowBuilderModel.findOne({
      where: { id: data.flowId, company_id: companyId }
    });

    if (!flow) {
      throw new AppError("Fluxo não encontrado nesta empresa", 404);
    }
  }

  // Check de seguidor: valida ação alternativa e texto do pedido de follow
  if (
    data.nonFollowerAction !== undefined &&
    data.nonFollowerAction !== null &&
    !VALID_NON_FOLLOWER_ACTIONS.includes(data.nonFollowerAction)
  ) {
    throw new AppError(
      `Ação para não-seguidor inválida. Use: ${VALID_NON_FOLLOWER_ACTIONS.join(", ")}`,
      400
    );
  }

  if (
    data.nonFollowerAction === "ask_follow" &&
    !(data.nonFollowerText && String(data.nonFollowerText).trim())
  ) {
    throw new AppError(
      "Informe a mensagem para pedir o follow (ação 'ask_follow')",
      400
    );
  }

  // Mídia de recompensa: exige URL http(s) e tipo de attachment válido
  if (data.rewardMediaUrl !== undefined && data.rewardMediaUrl !== null) {
    const url = String(data.rewardMediaUrl).trim();
    if (url && !/^https?:\/\//i.test(url)) {
      throw new AppError(
        "A URL da mídia de recompensa precisa ser http(s) pública",
        400
      );
    }
    if (url && data.rewardMediaType !== undefined && data.rewardMediaType !== null) {
      if (!VALID_REWARD_MEDIA_TYPES.includes(data.rewardMediaType)) {
        throw new AppError(
          `Tipo de mídia inválido. Use: ${VALID_REWARD_MEDIA_TYPES.join(", ")}`,
          400
        );
      }
    }
  } else if (data.rewardMediaType !== undefined && data.rewardMediaType !== null) {
    if (!VALID_REWARD_MEDIA_TYPES.includes(data.rewardMediaType)) {
      throw new AppError(
        `Tipo de mídia inválido. Use: ${VALID_REWARD_MEDIA_TYPES.join(", ")}`,
        400
      );
    }
  }
};

export default ValidateRuleData;
