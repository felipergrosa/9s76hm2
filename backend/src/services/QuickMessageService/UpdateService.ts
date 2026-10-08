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
  companyId: number | string;
}

const UpdateService = async (data: Data): Promise<QuickMessage> => {
  const { id, shortcode, message, userId, geral, mediaPath, mediaName, visao, groupName, color, isAdmin, delay, sendAsCaption, flow, companyId } = data;

  // Filtra por companyId para impedir edição cross-tenant
  const record = await QuickMessage.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  // Regra de edição (flags no padrão da referência):
  // - admin/superadmin editam qualquer mensagem;
  // - o dono (userId) sempre edita a própria;
  // - "geral" = permitir edição: qualquer usuário que a visualize pode editar o conteúdo.
  const isOwnerOrAdmin = isAdmin || record.userId === Number(userId);
  if (!isOwnerOrAdmin && record.geral !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const updateData: any = {
    shortcode,
    message,
    groupName,
    color,
    delay,
    sendAsCaption,
    flow
  };

  // As flags de compartilhamento (visao/geral) só podem ser alteradas pelo
  // dono ou admin — um editor convidado não pode revogar o compartilhamento
  // nem alterar a visibilidade da resposta de outro usuário.
  if (isOwnerOrAdmin) {
    updateData.geral = geral;
    updateData.visao = visao;
  }

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
