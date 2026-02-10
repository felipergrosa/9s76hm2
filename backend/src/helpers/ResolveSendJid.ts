import Contact from "../models/Contact";
import LidMapping from "../models/LidMapping";
import logger from "../utils/logger";
import { getWbot } from "../libs/wbot";

/**
 * Resolve o JID correto para envio de mensagens.
 * Se o contato tem remoteJid @lid, tenta resolver para o número real (PN).
 * Isso evita erros de criptografia "Bad MAC" ao enviar para LIDs.
 *
 * Estratégias de resolução (em ordem):
 *   1. Número real já salvo no contato
 *   2. Tabela LidMappings (cache persistente)
 *   3. signalRepository.lidMapping.getPNForLID() do Baileys (socket ativo)
 *   4. authState.keys.get("lid-mapping") do Baileys (keystore persistido)
 *   5. canonicalNumber do contato
 *   6. Fallback: usar LID (pode falhar)
 */

const looksPhoneLike = (digits: string): boolean =>
  digits.length >= 10 && digits.length <= 15 && /^\d+$/.test(digits);

const ResolveSendJid = async (
  contact: Contact,
  isGroup: boolean,
  whatsappId?: number
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
      looksPhoneLike(contactNumber)
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
        if (looksPhoneLike(pn)) {
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

    // 3. signalRepository.lidMapping.getPNForLID() — API do Baileys (socket ativo)
    if (!whatsappId) {
      logger.warn(`[ResolveSendJid] whatsappId não informado, não é possível consultar Baileys socket`);
    }
    try {
      const wbot = whatsappId ? getWbot(whatsappId) : null;
      if (wbot) {
        const sock = wbot as any;

        // 3a. signalRepository.lidMapping
        const lidStore = sock.signalRepository?.lidMapping;
        if (lidStore?.getPNForLID) {
          const resolvedPN = await lidStore.getPNForLID(lidNumber);
          if (resolvedPN) {
            const pnDigits = resolvedPN.replace(/\D/g, "");
            if (looksPhoneLike(pnDigits)) {
              const resolvedJid = resolvedPN.includes("@") ? resolvedPN : `${pnDigits}@s.whatsapp.net`;
              logger.info(`[ResolveSendJid] LID ${lidJid} → via signalRepository.lidMapping: ${resolvedJid}`);

              // Persistir para próximas vezes
              try {
                await LidMapping.upsert({
                  lid: lidJid,
                  phoneNumber: pnDigits,
                  companyId: contact.companyId,
                  whatsappId: wbot.id,
                  verified: true
                });
                await contact.update({
                  number: pnDigits,
                  remoteJid: resolvedJid,
                  lidJid: lidJid
                });
              } catch { /* não bloquear envio */ }

              return resolvedJid;
            }
          }
        }

        // 3b. authState.keys.get("lid-mapping") — keystore persistido no Redis
        const authKeys = sock.authState?.keys;
        if (authKeys?.get) {
          const data = await authKeys.get("lid-mapping", [lidNumber]);
          const raw = data?.[lidNumber];
          if (raw) {
            const jidStr = typeof raw === "string"
              ? raw
              : String(raw?.jid || raw?.pnJid || raw?.pn || raw?.phoneNumber || raw?.number || "");
            if (jidStr) {
              const pnDigits = jidStr.replace(/\D/g, "");
              if (looksPhoneLike(pnDigits)) {
                const resolvedJid = jidStr.includes("@") ? jidStr : `${pnDigits}@s.whatsapp.net`;
                logger.info(`[ResolveSendJid] LID ${lidJid} → via authState.keys lid-mapping: ${resolvedJid}`);

                try {
                  await LidMapping.upsert({
                    lid: lidJid,
                    phoneNumber: pnDigits,
                    companyId: contact.companyId,
                    whatsappId: wbot.id,
                    verified: true
                  });
                  await contact.update({
                    number: pnDigits,
                    remoteJid: resolvedJid,
                    lidJid: lidJid
                  });
                } catch { /* não bloquear envio */ }

                return resolvedJid;
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[ResolveSendJid] Erro ao resolver via Baileys socket: ${err?.message}`);
    }

    // 4. Tentar resolver via canonicalNumber do contato
    if (contact.canonicalNumber && looksPhoneLike(contact.canonicalNumber)) {
      const resolvedJid = `${contact.canonicalNumber}@s.whatsapp.net`;
      logger.info(`[ResolveSendJid] LID ${lidJid} → via canonicalNumber: ${resolvedJid}`);
      return resolvedJid;
    }

    // 5. Fallback: usar o LID mesmo (pode falhar com Bad MAC)
    logger.warn(`[ResolveSendJid] Não foi possível resolver LID ${lidJid} para número real. Usando LID como fallback.`);
    return lidJid;
  }

  // Sem remoteJid ou remoteJid inválido: construir a partir do número
  return `${contact.number}@${isGroup ? "g.us" : "s.whatsapp.net"}`;
};

export default ResolveSendJid;
