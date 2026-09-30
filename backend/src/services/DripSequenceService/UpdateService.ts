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
  id: string | number;
  companyId: number;
  name?: string;
  tagId?: number;
  whatsappId?: number | null;
  active?: boolean;
  steps?: StepInput[];
  endAction?: string;
  endActionTagId?: number | null;
  endActionStatus?: string;
  endActionQueueId?: number | null;
  endActionUserId?: number | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
}

const END_ACTIONS = ["none", "move_tag", "ticket_status", "assign_queue", "assign_user"];

const UpdateService = async (data: Request): Promise<DripSequence> => {
  // N2 (IDOR): só localiza follow-up do próprio tenant
  const record = await DripSequence.findOne({
    where: { id: data.id, companyId: data.companyId }
  });

  if (!record) {
    throw new AppError("Follow-up não encontrado", 404);
  }

  // Mesmas validações do Create — nunca confiar no frontend
  const endAction = data.endAction ?? record.endAction ?? "none";
  if (!END_ACTIONS.includes(endAction)) {
    throw new AppError("Ação final inválida");
  }
  const targetTag = data.endActionTagId ?? record.endActionTagId;
  const targetQueue = data.endActionQueueId ?? record.endActionQueueId;
  const targetUser = data.endActionUserId ?? record.endActionUserId;
  const targetStatus = data.endActionStatus ?? record.endActionStatus;
  if (endAction === "move_tag" && !targetTag) {
    throw new AppError("Selecione a lane/tag de destino para a ação final");
  }
  if (endAction === "ticket_status" && !["open", "pending", "closed"].includes(targetStatus || "")) {
    throw new AppError("Status do ticket inválido para a ação final");
  }
  if (endAction === "assign_queue" && !targetQueue) {
    throw new AppError("Selecione a fila de destino para a ação final");
  }
  if (endAction === "assign_user" && !targetUser) {
    throw new AppError("Selecione o atendente de destino para a ação final");
  }

  const windowOk = (v?: string | null) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!windowOk(data.sendWindowStart) || !windowOk(data.sendWindowEnd)) {
    throw new AppError("Janela de envio inválida — use formato HH:mm");
  }

  // API Oficial: se vier steps, todos precisam de template quando a conexão é oficial
  const resolvedWhatsappId = data.whatsappId !== undefined ? data.whatsappId : record.whatsappId;
  if (data.steps && resolvedWhatsappId) {
    const wa = await Whatsapp.findOne({
      where: { id: resolvedWhatsappId, companyId: record.companyId }
    });
    if (wa?.channelType === "official" && data.steps.some(s => !s.metaTemplateName)) {
      throw new AppError(
        "Conexão oficial: todas as etapas precisam de um template Meta aprovado",
        400
      );
    }
  }

  return sequelize.transaction(async transaction => {
    await record.update(
      {
        name: data.name ?? record.name,
        tagId: data.tagId ?? record.tagId,
        whatsappId: data.whatsappId !== undefined ? data.whatsappId : record.whatsappId,
        active: data.active !== undefined ? data.active : record.active,
        endAction,
        endActionTagId: data.endActionTagId !== undefined ? data.endActionTagId : record.endActionTagId,
        endActionStatus: data.endActionStatus !== undefined ? data.endActionStatus : record.endActionStatus,
        endActionQueueId: data.endActionQueueId !== undefined ? data.endActionQueueId : record.endActionQueueId,
        endActionUserId: data.endActionUserId !== undefined ? data.endActionUserId : record.endActionUserId,
        sendWindowStart: data.sendWindowStart !== undefined ? data.sendWindowStart : record.sendWindowStart,
        sendWindowEnd: data.sendWindowEnd !== undefined ? data.sendWindowEnd : record.sendWindowEnd
      },
      { transaction }
    );

    // Etapas já enviadas/em andamento (DripSequenceEnrollment) não são afetadas
    // por substituir as etapas aqui — apenas novas inscrições usam a lista nova.
    if (data.steps) {
      await DripSequenceStep.destroy({ where: { dripSequenceId: record.id }, transaction });
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
    }

    return record;
  });
};

export default UpdateService;
