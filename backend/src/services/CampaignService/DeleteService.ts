import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string,
  companyId: number
): Promise<void> => {
  // N2 (IDOR): só localiza/exclui campanha do próprio tenant
  const record = await Campaign.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  if (record.status === "EM_ANDAMENTO") {
    throw new AppError("Não é permitido excluir campanha em andamento", 400);
  }

  await record.destroy();
};

export default DeleteService;
