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
  id: string | number;
  name?: string;
  tagId?: number;
  whatsappId?: number | null;
  active?: boolean;
  steps?: StepInput[];
}

const UpdateService = async (data: Request): Promise<DripSequence> => {
  const record = await DripSequence.findByPk(data.id);

  if (!record) {
    throw new AppError("Sequência de drip não encontrada", 404);
  }

  return sequelize.transaction(async transaction => {
    await record.update(
      {
        name: data.name ?? record.name,
        tagId: data.tagId ?? record.tagId,
        whatsappId: data.whatsappId !== undefined ? data.whatsappId : record.whatsappId,
        active: data.active !== undefined ? data.active : record.active
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
          message: step.message
        })),
        { transaction }
      );
    }

    return record;
  });
};

export default UpdateService;
