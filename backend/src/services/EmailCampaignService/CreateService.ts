import EmailCampaign from "../../models/EmailCampaign";
import AppError from "../../errors/AppError";

interface Request {
  name: string;
  subject: string;
  message: string;
  contactListId?: number | string | null;
  scheduledAt?: string | null;
  companyId: number;
  userId?: number | string | null;
}

const CreateService = async (data: Request): Promise<EmailCampaign> => {
  if (!data.name || !data.subject || !data.message) {
    throw new AppError("Nome, assunto e mensagem são obrigatórios");
  }

  const status = data.scheduledAt ? "PROGRAMADA" : "INATIVA";

  const record = await EmailCampaign.create({
    ...data,
    status
  } as any);

  return record;
};

export default CreateService;
