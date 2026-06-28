import EmailCampaign from "../../models/EmailCampaign";
import AppError from "../../errors/AppError";

export const CancelService = async (id: string | number): Promise<void> => {
  const record = await EmailCampaign.findByPk(id);

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  await record.update({ status: "CANCELADA" });
};
