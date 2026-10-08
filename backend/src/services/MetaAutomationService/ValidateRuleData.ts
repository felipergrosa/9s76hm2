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

interface RuleData {
  name?: string;
  whatsappId?: number | null;
  channel?: string;
  trigger?: string;
  flowId?: number | null;
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
};

export default ValidateRuleData;
