import Contact from "../models/Contact";
import LidMapping from "../models/LidMapping";
import logger from "../utils/logger";

/**
 * Resolve o JID correto para envio de mensagens.
 * Se o contato tem remoteJid @lid, tenta resolver para o número real (PN).
 * Isso evita erros de criptografia "Bad MAC" ao enviar para LIDs.
 */
const ResolveSendJid = async (
  contact: Contact,
  isGroup: boolean
): Promise<string> => {
  // Se tem remoteJid válido e NÃO é LID, usar diretamente
  if (
    contact.remoteJid &&
    contact.remoteJid !== "" &&
    contact.remoteJid.includes("@") &&
    !contact.remoteJid.includes("@lid")
  ) {
    return contact.remoteJid;
  }

  // Se é LID, tentar resolver para número real
  if (contact.remoteJid && contact.remoteJid.includes("@lid")) {
    const lidJid = contact.remoteJid;
    const lidNumber = lidJid.replace("@lid", "");

    // 1. Se o contato já tem um número real (não é PENDING_ e não é o próprio LID)
    const contactNumber = String(contact.number || "");
    if (
      contactNumber &&
      !contactNumber.startsWith("PENDING_") &&
      contactNumber !== lidNumber &&
      contactNumber.length >= 10 &&
      contactNumber.length <= 15
    ) {
      const resolvedJid = `${contactNumber}@s.whatsapp.net`;
      logger.info(`[ResolveSendJid] LID ${lidJid} → número real do contato: ${resolvedJid}`);
      return resolvedJid;
    }

    // 2. Tentar resolver via tabela LidMapping
    try {
      const mapping = await LidMapping.findOne({
        where: { lid: lidJid, companyId: contact.companyId }
      });
      if (mapping && mapping.phoneNumber) {
        const pn = mapping.phoneNumber.replace(/\D/g, "");
        if (pn.length >= 10) {
          const resolvedJid = `${pn}@s.whatsapp.net`;
          logger.info(`[ResolveSendJid] LID ${lidJid} → via LidMapping: ${resolvedJid}`);

          // Atualizar contato com número real para próximas vezes
          await contact.update({
            number: pn,
            remoteJid: resolvedJid,
            lidJid: lidJid
          });

          return resolvedJid;
        }
      }
    } catch (err) {
      logger.warn(`[ResolveSendJid] Erro ao consultar LidMapping: ${err}`);
    }

    // 3. Tentar resolver via canonicalNumber do contato
    if (contact.canonicalNumber && contact.canonicalNumber.length >= 10) {
      const resolvedJid = `${contact.canonicalNumber}@s.whatsapp.net`;
      logger.info(`[ResolveSendJid] LID ${lidJid} → via canonicalNumber: ${resolvedJid}`);
      return resolvedJid;
    }

    // 4. Fallback: usar o LID mesmo (pode falhar com Bad MAC)
    logger.warn(`[ResolveSendJid] Não foi possível resolver LID ${lidJid} para número real. Usando LID como fallback.`);
    return lidJid;
  }

  // Sem remoteJid ou remoteJid inválido: construir a partir do número
  return `${contact.number}@${isGroup ? "g.us" : "s.whatsapp.net"}`;
};

export default ResolveSendJid;
