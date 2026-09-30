import EmailCampaign from "../../models/EmailCampaign";
import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: number
): Promise<EmailCampaign> => {
  // N2 (IDOR): restringe a busca ao tenant autenticado
  const record = await EmailCampaign.findOne({
    where: { id, companyId },
    include: [{ model: ContactList }]
  });

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  return record;
};

export default ShowService;
