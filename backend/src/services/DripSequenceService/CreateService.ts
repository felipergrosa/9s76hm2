import sequelize from "../../database";
import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
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
}

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

  return sequelize.transaction(async transaction => {
    const record = await DripSequence.create(
      {
        name: data.name,
        tagId: data.tagId,
        whatsappId: data.whatsappId || null,
        companyId: data.companyId,
        active: true
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
