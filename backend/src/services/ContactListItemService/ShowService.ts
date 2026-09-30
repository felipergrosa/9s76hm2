import ContactListItem from "../../models/ContactListItem";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: string | number
): Promise<ContactListItem> => {
  // Segurança: escopo por empresa para evitar IDOR entre tenants
  const record = await ContactListItem.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLISTITEM_FOUND", 404);
  }

  return record;
};

export default ShowService;
