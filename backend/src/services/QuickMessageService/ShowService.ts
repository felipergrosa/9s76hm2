import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";

const ShowService = async (id: string | number, companyId: number | string): Promise<QuickMessage> => {
  // Filtra por companyId para impedir acesso cross-tenant
  const record = await QuickMessage.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  return record;
};

export default ShowService;
