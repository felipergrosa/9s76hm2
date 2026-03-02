import { QueryTypes, Sequelize } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import logger from "../../utils/logger";

/**
 * Serviço para associar automaticamente LIDs a contatos existentes
 * baseado em correspondência de número de telefone
 */
export const AutoAssociateLidsService = async (companyId: number): Promise<void> => {
  try {
    const sequelize = Contact.sequelize!;

    // 1. Buscar LIDs que enviaram mensagens mas não têm contato associado
    const [unmappedLids] = await sequelize.query(`
      SELECT DISTINCT m.participant as lid
      FROM "Messages" m
      LEFT JOIN "Contacts" c ON c."lidJid" = m.participant OR c."remoteJid" = m.participant
      WHERE m.participant LIKE '%@lid'
        AND m."fromMe" = false
        AND c.id IS NULL
    `);

    logger.info(`[AutoAssociateLids] Encontrados ${unmappedLids.length} LIDs sem contato associado`);

    // 2. Buscar contatos individuais sem lidJid
    const [contactsWithoutLid] = await sequelize.query(`
      SELECT id, name, number, "canonicalNumber", "remoteJid"
      FROM "Contacts"
      WHERE "companyId" = :companyId
        AND "isGroup" = false
        AND "lidJid" IS NULL
        AND number IS NOT NULL
        AND number != ''
    `, {
      replacements: { companyId },
      type: QueryTypes.SELECT
    });

    logger.info(`[AutoAssociateLids] Encontrados ${(contactsWithoutLid as any[]).length} contatos sem LID`);

    // 3. Buscar mapeamentos LID→phoneNumber do Baileys (LidMapping)
    const [lidMappings] = await sequelize.query(`
      SELECT lid, "phoneNumber"
      FROM "LidMappings"
      WHERE "companyId" = :companyId
        AND verified = true
    `, {
      replacements: { companyId },
      type: QueryTypes.SELECT
    });

    logger.info(`[AutoAssociateLids] Encontrados ${(lidMappings as any[]).length} mapeamentos LID→PN`);

    // 4. Associar LIDs a contatos por número
    let associated = 0;
    for (const mapping of lidMappings as any[]) {
      const { lid, phoneNumber } = mapping;
      
      // Buscar contato pelo número
      const contact = (contactsWithoutLid as any[]).find(c => 
        c.number === phoneNumber || 
        c.canonicalNumber === phoneNumber ||
        c.number?.replace(/\D/g, '') === phoneNumber ||
        c.canonicalNumber?.replace(/\D/g, '') === phoneNumber
      );

      if (contact) {
        await sequelize.query(`
          UPDATE "Contacts"
          SET "lidJid" = :lid
          WHERE id = :contactId
        `, {
          replacements: { lid, contactId: contact.id }
        });

        // Atualizar senderName das mensagens
        await Message.update(
          { senderName: contact.name },
          { where: { participant: lid, senderName: null } }
        );

        logger.info(`[AutoAssociateLids] LID ${lid} → Contato ${contact.name} (${phoneNumber})`);
        associated++;
      }
    }

    logger.info(`[AutoAssociateLids] Associações realizadas: ${associated}`);
  } catch (err: any) {
    logger.error(`[AutoAssociateLids] Erro: ${err?.message}`);
  }
};

export default AutoAssociateLidsService;
