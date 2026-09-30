import EmailCampaign from "../../models/EmailCampaign";
import AppError from "../../errors/AppError";

export const CancelService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  // N2 (IDOR): só cancela campanha do próprio tenant
  const record = await EmailCampaign.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  await record.update({ status: "CANCELADA" });
};
