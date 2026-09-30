import EmailCampaign from "../../models/EmailCampaign";
import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  companyId: number;
  name?: string;
  subject?: string;
  message?: string;
  contactListId?: number | string | null;
  scheduledAt?: string | null;
}

const UpdateService = async (data: Request): Promise<EmailCampaign> => {
  const { id, companyId } = data;

  // N2 (IDOR): só localiza campanha do próprio tenant
  const record = await EmailCampaign.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  if (record.status === "EM_ANDAMENTO") {
    throw new AppError("Não é possível editar uma campanha em andamento");
  }

  // N2: lista de contatos precisa pertencer ao mesmo tenant
  if (data.contactListId) {
    const belongs = await ContactList.count({
      where: { id: data.contactListId, companyId }
    });
    if (belongs === 0) {
      throw new AppError("Lista de contatos não pertence a esta empresa", 400);
    }
  }

  const status = data.scheduledAt
    ? "PROGRAMADA"
    : record.status === "PROGRAMADA"
      ? "INATIVA"
      : record.status;

  // N2 (mass assignment): whitelist explícita — ignora id, companyId, userId,
  // completedAt e timestamps vindos do body
  await record.update({
    name: data.name !== undefined ? data.name : record.name,
    subject: data.subject !== undefined ? data.subject : record.subject,
    message: data.message !== undefined ? data.message : record.message,
    contactListId:
      data.contactListId !== undefined ? data.contactListId : record.contactListId,
    scheduledAt:
      data.scheduledAt !== undefined ? data.scheduledAt : record.scheduledAt,
    status
  });

  return record;
};

export default UpdateService;
