import EmailCampaign from "../../models/EmailCampaign";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  // N2 (IDOR): só localiza/exclui campanha do próprio tenant
  const record = await EmailCampaign.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  if (record.status === "EM_ANDAMENTO") {
    throw new AppError("Não é possível excluir uma campanha em andamento");
  }

  await record.destroy();
};

export default DeleteService;
