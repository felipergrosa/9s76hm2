import sequelize from "../../database";
import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

interface StepInput {
  order: number;
  delayDays: number;
  delayMinutes?: number;
  message: string;
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
  metaTemplateVariables?: string;
}

interface Request {
  name: string;
  tagId: number;
  whatsappId?: number | null;
  steps: StepInput[];
  companyId: number;
  endAction?: string;
  endActionTagId?: number | null;
  endActionStatus?: string;
  endActionQueueId?: number | null;
  endActionUserId?: number | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
}

const END_ACTIONS = ["none", "move_tag", "ticket_status", "assign_queue", "assign_user"];

const CreateService = async (data: Request): Promise<DripSequence> => {
  if (!data.name || !data.tagId) {
    throw new AppError("Nome e tag são obrigatórios");
  }

  if (!data.steps || data.steps.length === 0) {
    throw new AppError("Adicione ao menos uma etapa de mensagem");
  }

  const hasContent = (s: StepInput) =>
    (s.message && s.message.trim()) || (s.metaTemplateName && s.metaTemplateName.trim());
  if (!data.steps.every(hasContent)) {
    throw new AppError("Cada etapa precisa de mensagem ou template Meta");
  }

  // API Oficial: fora da janela de 24h só template Meta entrega — fluxo validado
  // de ponta a ponta exige template em todas as etapas
  if (data.whatsappId) {
    const wa = await Whatsapp.findOne({
      where: { id: data.whatsappId, companyId: data.companyId }
    });
    if (wa?.channelType === "official" && data.steps.some(s => !s.metaTemplateName)) {
      throw new AppError(
        "Conexão oficial: todas as etapas precisam de um template Meta aprovado",
        400
      );
    }
  }

  const endAction = data.endAction || "none";
  if (!END_ACTIONS.includes(endAction)) {
    throw new AppError("Ação final inválida");
  }
  if (endAction === "move_tag" && !data.endActionTagId) {
    throw new AppError("Selecione a lane/tag de destino para a ação final");
  }
  if (endAction === "move_tag" && data.endActionTagId) {
    const targetLane = await import("../../models/Tag").then(m => m.default.findByPk(data.endActionTagId));
    if (!targetLane || Number(targetLane.kanban) !== 1) {
      throw new AppError("A ação final de movimentação exige uma lane do Kanban como destino");
    }
  }
  if (endAction === "ticket_status" && !["open", "pending", "closed"].includes(data.endActionStatus || "")) {
    throw new AppError("Status do ticket inválido para a ação final");
  }
  if (endAction === "assign_queue" && !data.endActionQueueId) {
    throw new AppError("Selecione a fila de destino para a ação final");
  }
  if (endAction === "assign_user" && !data.endActionUserId) {
    throw new AppError("Selecione o atendente de destino para a ação final");
  }

  const windowOk = (v?: string | null) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!windowOk(data.sendWindowStart) || !windowOk(data.sendWindowEnd)) {
    throw new AppError("Janela de envio inválida — use formato HH:mm");
  }

  return sequelize.transaction(async transaction => {
    const record = await DripSequence.create(
      {
        name: data.name,
        tagId: data.tagId,
        whatsappId: data.whatsappId || null,
        companyId: data.companyId,
        active: true,
        endAction,
        endActionTagId: data.endActionTagId || null,
        endActionStatus: data.endActionStatus || null,
        endActionQueueId: data.endActionQueueId || null,
        endActionUserId: data.endActionUserId || null,
        sendWindowStart: data.sendWindowStart || null,
        sendWindowEnd: data.sendWindowEnd || null
      } as any,
      { transaction }
    );

    await DripSequenceStep.bulkCreate(
      data.steps.map((step, index) => ({
        dripSequenceId: record.id,
        order: step.order ?? index,
        delayDays: step.delayDays ?? 0,
        delayMinutes: step.delayMinutes ?? 0,
        message: step.message || "",
        metaTemplateName: step.metaTemplateName || null,
        metaTemplateLanguage: step.metaTemplateLanguage || null,
        metaTemplateVariables:
          typeof step.metaTemplateVariables === "string"
            ? step.metaTemplateVariables
            : step.metaTemplateVariables
            ? JSON.stringify(step.metaTemplateVariables)
            : null
      })),
      { transaction }
    );

    return record;
  });
};

export default CreateService;
