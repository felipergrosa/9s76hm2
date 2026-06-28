import EmailCampaign from "../../models/EmailCampaign";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  name?: string;
  subject?: string;
  message?: string;
  contactListId?: number | string | null;
  scheduledAt?: string | null;
}

const UpdateService = async (data: Request): Promise<EmailCampaign> => {
  const { id } = data;

  const record = await EmailCampaign.findByPk(id);

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  if (record.status === "EM_ANDAMENTO") {
    throw new AppError("Não é possível editar uma campanha em andamento");
  }

  const status = data.scheduledAt
    ? "PROGRAMADA"
    : record.status === "PROGRAMADA"
      ? "INATIVA"
      : record.status;

  await record.update({ ...data, status });

  return record;
};

export default UpdateService;
