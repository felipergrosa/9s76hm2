import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";

interface Data {
  shortcode: string;
  message: string;
  userId: number | string;
  id?: number | string;
  geral: boolean;
  mediaPath?: string | null;
  visao: boolean;
  groupName?: string;
  color?: string;
  isAdmin?: boolean;
}

const UpdateService = async (data: Data): Promise<QuickMessage> => {
  const { id, shortcode, message, userId, geral, mediaPath, visao, groupName, color, isAdmin } = data;

  const record = await QuickMessage.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  // Admin/superadmin podem editar qualquer mensagem
  // User padrão só edita as próprias
  if (!isAdmin && record.userId !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await record.update({
    shortcode,
    message,
    geral,
    mediaPath,
    visao,
    groupName,
    color
  });

  return record;
};

export default UpdateService;
