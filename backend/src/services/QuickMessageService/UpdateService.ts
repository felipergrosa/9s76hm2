import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";

interface Data {
  shortcode: string;
  message: string;
  userId: number | string;
  id?: number | string;
  geral: boolean;
  mediaPath?: string | null;
  mediaName?: string | null;
  visao: boolean;
  groupName?: string;
  color?: string;
  isAdmin?: boolean;
  delay?: number;
  sendAsCaption?: boolean;
  flow?: string;
}

const UpdateService = async (data: Data): Promise<QuickMessage> => {
  const { id, shortcode, message, userId, geral, mediaPath, mediaName, visao, groupName, color, isAdmin, delay, sendAsCaption, flow } = data;

  const record = await QuickMessage.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  // Admin/superadmin podem editar qualquer mensagem
  // User padrão só edita as próprias
  if (!isAdmin && record.userId !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const updateData: any = {
    shortcode,
    message,
    geral,
    visao,
    groupName,
    color,
    delay,
    sendAsCaption,
    flow
  };

  if (mediaPath !== undefined) {
    updateData.mediaPath = mediaPath;
  }

  if (mediaName !== undefined) {
    updateData.mediaName = mediaName;
  }

  await record.update(updateData);

  if (groupName && color) {
    await QuickMessage.update(
      { color },
      {
        where: {
          groupName,
          companyId: record.companyId
        }
      }
    );
  }

  return record;
};

export default UpdateService;
