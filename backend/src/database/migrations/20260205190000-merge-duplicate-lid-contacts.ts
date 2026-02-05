import { QueryInterface, Sequelize, Op } from "sequelize";

/**
 * Migration para mesclar contatos duplicados (LID vs número real)
 * 
 * Problema: Quando mensagens chegam com LID não resolvido, o sistema cria um contato temporário.
 * Quando a mesma pessoa envia mensagem com número real, cria outro contato.
 * Resultado: dois contatos para a mesma pessoa.
 * 
 * Solução: Esta migration busca contatos com remoteJid @lid que tenham outro contato
 * com o mesmo nome (pushName) e mescla automaticamente.
 */
module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log("[Migration] Iniciando mesclagem de contatos duplicados LID...");

      // 1. Buscar contatos com LID que podem ter duplicados
      const [lidContacts] = await queryInterface.sequelize.query(`
        SELECT 
          c1.id as lid_id,
          c1.name as lid_name,
          c1.number as lid_number,
          c1."remoteJid" as lid_jid,
          c1."companyId",
          c2.id as real_id,
          c2.name as real_name,
          c2.number as real_number,
          c2."remoteJid" as real_jid
        FROM "Contacts" c1
        INNER JOIN "Contacts" c2 ON 
          c1."companyId" = c2."companyId"
          AND c1.id != c2.id
          AND c1."isGroup" = false
          AND c2."isGroup" = false
          AND c1."remoteJid" LIKE '%@lid'
          AND (c2."remoteJid" NOT LIKE '%@lid' OR c2."remoteJid" IS NULL)
          AND (
            -- Mesmo nome (case insensitive)
            LOWER(TRIM(c1.name)) = LOWER(TRIM(c2.name))
            -- Ou número do LID contém parte do número real
            OR c2.number LIKE '%' || RIGHT(c1.number, 8) || '%'
          )
        WHERE c1.name IS NOT NULL 
          AND c1.name != ''
          AND c1.name !~ '^[0-9]+$'
        ORDER BY c1."companyId", c1.id
      `, { transaction });

      if (!lidContacts || (lidContacts as any[]).length === 0) {
        console.log("[Migration] Nenhum contato duplicado LID encontrado.");
        await transaction.commit();
        return;
      }

      console.log(`[Migration] Encontrados ${(lidContacts as any[]).length} pares de contatos duplicados.`);

      let mergedCount = 0;
      let ticketsMoved = 0;
      let messagesMoved = 0;

      for (const pair of lidContacts as any[]) {
        const { lid_id, lid_name, lid_number, real_id, real_name, real_number, companyId } = pair;

        console.log(`[Migration] Mesclando LID ${lid_id} (${lid_name}/${lid_number}) -> Real ${real_id} (${real_name}/${real_number})`);

        // 2. Mover tickets do contato LID para o contato real
        const [, ticketResult] = await queryInterface.sequelize.query(`
          UPDATE "Tickets" 
          SET "contactId" = :realId 
          WHERE "contactId" = :lidId AND "companyId" = :companyId
        `, {
          replacements: { realId: real_id, lidId: lid_id, companyId },
          transaction
        });
        ticketsMoved += (ticketResult as any)?.rowCount || 0;

        // 3. Mover mensagens do contato LID para o contato real
        const [, messageResult] = await queryInterface.sequelize.query(`
          UPDATE "Messages" 
          SET "contactId" = :realId 
          WHERE "contactId" = :lidId AND "companyId" = :companyId
        `, {
          replacements: { realId: real_id, lidId: lid_id, companyId },
          transaction
        });
        messagesMoved += (messageResult as any)?.rowCount || 0;

        // 4. Atualizar contato real com remoteJid do LID (para referência futura)
        // Não sobrescreve se já tiver um remoteJid válido
        await queryInterface.sequelize.query(`
          UPDATE "Contacts" 
          SET "updatedAt" = NOW()
          WHERE id = :realId
        `, {
          replacements: { realId: real_id },
          transaction
        });

        // 5. Remover contato LID duplicado
        await queryInterface.sequelize.query(`
          DELETE FROM "Contacts" WHERE id = :lidId
        `, {
          replacements: { lidId: lid_id },
          transaction
        });

        mergedCount++;
      }

      await transaction.commit();

      console.log(`[Migration] Mesclagem concluída!`);
      console.log(`[Migration] - Contatos mesclados: ${mergedCount}`);
      console.log(`[Migration] - Tickets movidos: ${ticketsMoved}`);
      console.log(`[Migration] - Mensagens movidas: ${messagesMoved}`);

    } catch (error) {
      await transaction.rollback();
      console.error("[Migration] Erro ao mesclar contatos:", error);
      throw error;
    }
  },

  async down(queryInterface: QueryInterface, Sequelize: Sequelize) {
    // Esta migration não pode ser revertida automaticamente
    // pois os contatos LID já foram removidos
    console.log("[Migration] Rollback não disponível para esta migration.");
    console.log("[Migration] Se necessário, restaure backup do banco de dados.");
  }
};
