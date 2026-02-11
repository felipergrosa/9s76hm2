import { Op } from "sequelize";
import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import logger from "../../utils/logger";
import { ExtractedIdentifiers } from "./extractMessageIdentifiers";

/**
 * CAMADA 2: RESOLUÇÃO (busca no banco, sem criação)
 *
 * Busca contato existente usando os identificadores extraídos.
 * Ordem de busca (curto-circuito no primeiro match):
 *   1. Se pnCanonical → buscar por canonicalNumber
 *   2. Se lidJid → buscar por lidJid
 *   3. Se lidJid → consultar LidMapping → obter PN → buscar por canonicalNumber
 *
 * Efeito colateral ÚNICO: se encontrou contato e lidJid novo,
 * UPDATE Contact SET lidJid = ? WHERE id = ? (atômico)
 */

export interface ResolveResult {
  contact: Contact | null;
  /** Se o lidJid do contato foi atualizado como efeito colateral */
  lidJidUpdated: boolean;
  /** Se o PN foi descoberto via LidMapping (útil para camada 3) */
  pnFromMapping: string | null;
}

export async function resolveContact(
  ids: ExtractedIdentifiers,
  companyId: number
): Promise<ResolveResult> {
  let lidJidUpdated = false;
  let pnFromMapping: string | null = null;

  // ─────────────────────────────────────────────────
  // BUSCA 1: por canonicalNumber (quando sabemos o PN)
  // ─────────────────────────────────────────────────
  if (ids.pnCanonical) {
    const contact = await Contact.findOne({
      where: {
        companyId,
        isGroup: false,
        [Op.or]: [
          { canonicalNumber: ids.pnCanonical },
          { number: ids.pnCanonical }
        ]
      }
    });

    if (contact) {
      // Efeito colateral: popular lidJid se temos LID novo
      if (ids.lidJid && !contact.lidJid) {
        try {
          await contact.update({ lidJid: ids.lidJid });
          lidJidUpdated = true;
          logger.info({
            contactId: contact.id,
            lidJid: ids.lidJid
          }, "[resolveContact] lidJid preenchido em contato existente via PN");
        } catch (err: any) {
          // Pode falhar se outro contato já tem esse lidJid (constraint unique)
          logger.warn({ err: err?.message, lidJid: ids.lidJid }, "[resolveContact] Falha ao preencher lidJid");
        }
      }

      // Efeito colateral: atualizar remoteJid se temos PN e contato tinha LID como remoteJid
      if (ids.pnJid && contact.remoteJid?.includes("@lid")) {
        try {
          await contact.update({ remoteJid: ids.pnJid });
          logger.info({
            contactId: contact.id,
            oldRemoteJid: contact.remoteJid,
            newRemoteJid: ids.pnJid
          }, "[resolveContact] remoteJid corrigido de LID para PN");
        } catch (err: any) {
          logger.warn({ err: err?.message }, "[resolveContact] Falha ao corrigir remoteJid");
        }
      }

      logger.info({
        contactId: contact.id,
        strategy: "pnCanonical"
      }, "[resolveContact] Contato encontrado");
      return { contact, lidJidUpdated, pnFromMapping };
    }
  }

  // ─────────────────────────────────────────────────
  // BUSCA 2: por lidJid direto (quando só temos LID)
  // ─────────────────────────────────────────────────
  if (ids.lidJid) {
    const contact = await Contact.findOne({
      where: {
        companyId,
        lidJid: ids.lidJid,
        isGroup: false
      }
    });

    if (contact) {
      logger.info({
        contactId: contact.id,
        strategy: "lidJid"
      }, "[resolveContact] Contato encontrado");
      return { contact, lidJidUpdated, pnFromMapping };
    }

    // Fallback: buscar por remoteJid = lidJid (contatos antigos sem campo lidJid)
    const contactByRemoteJid = await Contact.findOne({
      where: {
        companyId,
        remoteJid: ids.lidJid,
        isGroup: false
      }
    });

    if (contactByRemoteJid) {
      // Contato encontrado com remoteJid = LID
      // NÃO migrar lidJid aqui — lidJid só é preenchido quando contato é reconciliado com número real

      logger.info({
        contactId: contactByRemoteJid.id,
        strategy: "remoteJid-fallback"
      }, "[resolveContact] Contato encontrado via remoteJid (LID)");
      return { contact: contactByRemoteJid, lidJidUpdated, pnFromMapping };
    }
  }

  // ─────────────────────────────────────────────────
  // BUSCA 3: LidMapping → PN → canonicalNumber
  // ─────────────────────────────────────────────────
  if (ids.lidJid) {
    const mapping = await LidMapping.findOne({
      where: {
        lid: ids.lidJid,
        companyId
      }
    });

    if (mapping?.phoneNumber) {
      pnFromMapping = mapping.phoneNumber;

      const contact = await Contact.findOne({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { canonicalNumber: mapping.phoneNumber },
            { number: mapping.phoneNumber }
          ]
        }
      });

      if (contact) {
        // Preencher lidJid no contato encontrado
        if (!contact.lidJid) {
          try {
            await contact.update({ lidJid: ids.lidJid });
            lidJidUpdated = true;
          } catch (err: any) {
            logger.warn({ err: err?.message }, "[resolveContact] Falha ao preencher lidJid via LidMapping");
          }
        }

        logger.info({
          contactId: contact.id,
          strategy: "lidMapping",
          pn: mapping.phoneNumber
        }, "[resolveContact] Contato encontrado via LidMapping");
        return { contact, lidJidUpdated, pnFromMapping };
      }
    }
  }

  // ─────────────────────────────────────────────────
  // BUSCA 4 (grupo): por number = groupJid
  // ─────────────────────────────────────────────────
  if (ids.isGroup && ids.groupJid) {
    const groupNumber = ids.groupJid.replace("@g.us", "");
    const contact = await Contact.findOne({
      where: {
        companyId,
        isGroup: true,
        [Op.or]: [
          { number: ids.groupJid },
          { number: groupNumber },
          { remoteJid: ids.groupJid }
        ]
      }
    });

    if (contact) {
      logger.info({
        contactId: contact.id,
        strategy: "group"
      }, "[resolveContact] Grupo encontrado");
      return { contact, lidJidUpdated, pnFromMapping };
    }
  }

  // Nenhum contato encontrado
  logger.debug({
    pnCanonical: ids.pnCanonical,
    lidJid: ids.lidJid,
    companyId
  }, "[resolveContact] Nenhum contato encontrado");

  return { contact: null, lidJidUpdated, pnFromMapping };
}
