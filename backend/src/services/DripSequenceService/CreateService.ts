import sequelize from "../../database";
import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import AppError from "../../errors/AppError";

interface StepInput {
  order: number;
  delayDays: number;
  message: string;
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
        message: step.message
      })),
      { transaction }
    );

    return record;
  });
};

export default CreateService;
