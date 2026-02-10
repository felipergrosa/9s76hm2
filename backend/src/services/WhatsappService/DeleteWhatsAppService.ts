import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // Registrar no log ANTES de apagar, para preservar vínculo número<->id
  try {
    const { onConnectionDelete } = require("./WhatsappConnectionGuardService");
    await onConnectionDelete(whatsapp.id, whatsapp.companyId, whatsapp.number || "");
  } catch (err: any) {
    logger.warn(`[DeleteWhatsAppService] Falha ao registrar exclusão no ConnectionGuard: ${err?.message}`);
  }

  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
