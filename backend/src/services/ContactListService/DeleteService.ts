import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string,
  companyId: string | number
): Promise<void> => {
  // Segurança: escopo por empresa para evitar IDOR entre tenants
  const record = await ContactList.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
  }

  await record.destroy();
};

export default DeleteService;
