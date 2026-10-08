import MetaAutomationRule from "../../models/MetaAutomationRule";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  // N2 (IDOR): só localiza/exclui regra do próprio tenant
  const record = await MetaAutomationRule.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("Automação não encontrada", 404);
  }

  // Hard delete — mesmo padrão de DripSequence/FlowCampaign
  await record.destroy();
};

export default DeleteService;
