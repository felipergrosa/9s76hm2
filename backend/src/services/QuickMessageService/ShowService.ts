import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: number | string,
  userId?: number | string,
  isAdmin: boolean = false
): Promise<QuickMessage> => {
  // Filtra por companyId para impedir acesso cross-tenant
  const record = await QuickMessage.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  // Visibilidade: usuário comum só enxerga respostas globais (visao=true)
  // ou as próprias. Admin/superadmin visualizam todas.
  if (!isAdmin && record.visao !== true && record.userId !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return record;
};

export default ShowService;
