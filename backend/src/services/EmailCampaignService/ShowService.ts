import EmailCampaign from "../../models/EmailCampaign";
import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";

const ShowService = async (id: string | number): Promise<EmailCampaign> => {
  const record = await EmailCampaign.findByPk(id, {
    include: [{ model: ContactList }]
  });

  if (!record) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  return record;
};

export default ShowService;
