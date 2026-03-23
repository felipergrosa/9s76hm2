import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import CheckIsValidContact from "../WbotServices/CheckIsValidContact";
import RefreshContactAvatarService from "./RefreshContactAvatarService";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface Request {
  contactId: number;
  companyId: number;
  force?: boolean;
  ttlHours?: number; // Padrão 24h
}

const ValidateContactService = async ({
  contactId,
  companyId,
  force = false,
  ttlHours = 24
}: Request): Promise<Contact | null> => {
  logger.info({ contactId, companyId, force, ttlHours }, "[ValidateContact] início");
  const contact = await Contact.findOne({
  where: { id: contactId, companyId },
  include: [
    { model: Tag, as: "tags", attributes: ["id", "name", "color", "updatedAt"] }
  ]
});
  if (!contact) return null;

  // Apenas canal WhatsApp e não grupo
  if (!contact.channels?.includes("whatsapp") || contact.isGroup) {
    logger.info({ contactId, companyId, channels: contact.channels, isGroup: contact.isGroup }, "[ValidateContact] ignorado: não é whatsapp ou é grupo");
    return contact;
  }

  // Se já está validado como true e não é uma validação forçada, não altere nada
  if (!force && contact.isWhatsappValid === true) {
    logger.info({ contactId, companyId }, "[ValidateContact] já validado=true; não alterar");
    return contact;
  }

  const now = Date.now();
  const last = contact.validatedAt ? new Date(contact.validatedAt).getTime() : 0;
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const withinTTL = last > 0 && now - last < ttlMs;

  if (!force && withinTTL) {
    logger.info({ contactId, companyId, last, now, ttlMs }, "[ValidateContact] ignorado por TTL");
    return contact;
  }

  let isValid: boolean | null = null;
  try {
    logger.info({ contactId, companyId, number: contact.number }, "[ValidateContact] validando número no WhatsApp");
    await CheckIsValidContact(contact.number, companyId);
    isValid = true;
    logger.info({ contactId, companyId }, "[ValidateContact] resultado: válido");
  } catch (err: any) {
    // Se for número inválido, marca como falso, senão mantém nulo e loga
    if (err?.message === "ERR_WAPP_INVALID_CONTACT" || err?.message === "invalidNumber") {
      isValid = false;
      logger.info({ contactId, companyId }, "[ValidateContact] resultado: inválido");
    } else {
      logger.warn({ contactId, companyId, error: err?.message }, "[ValidateContact] falha ao validar contato");
    }
  }

  try {
    await contact.update({
      isWhatsappValid: isValid,
      validatedAt: new Date()
    });
    logger.info({ contactId, companyId, isWhatsappValid: isValid }, "[ValidateContact] campos atualizados");

    // Emite atualização em tempo real para frontend (lista de Contacts)
    try {
      const io = getIO();
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
      logger.info({ contactId, companyId }, "[ValidateContact] evento socket emitido");
    } catch (e: any) {
      logger.warn({ contactId, companyId, error: e?.message }, "[ValidateContact] falha ao emitir socket");
    }
  } catch (e: any) {
    logger.warn({ contactId, companyId, error: e?.message }, "[ValidateContact] falha ao atualizar contato");
  }

  // Atualiza avatar se necessário (ou quando forçado)
  try {
    const hasLocal = !!contact.getDataValue("urlPicture");
    const shouldUpdateAvatar = force || !hasLocal || contact.pictureUpdated === false;
    if (shouldUpdateAvatar) {
      await RefreshContactAvatarService({ contactId: contact.id, companyId, whatsappId: contact.whatsappId });
    }
  } catch (e: any) {
    logger.warn({ contactId, companyId, error: e?.message }, "[ValidateContact] falha ao atualizar avatar");
  }

  return contact;
};

export default ValidateContactService;
