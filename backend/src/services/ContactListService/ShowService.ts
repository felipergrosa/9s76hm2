import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: string | number
): Promise<ContactList> => {
  // Segurança: escopo por empresa para evitar IDOR entre tenants
  const record = await ContactList.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  return record;
};

export default ShowService;
