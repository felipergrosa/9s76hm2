import { QueryInterface, Sequelize } from "sequelize";

/**
 * Migration automática para fazer merge de contatos duplicados
 * 
 * Esta migration identifica contatos com IDs Meta (números > 13 dígitos)
 * e faz merge automático com contatos reais (mesmo nome, número válido).
 * 
 * Executada automaticamente durante o deploy, uma única vez.
 */

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: Sequelize) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] 🔧 Iniciando merge automático de contatos duplicados...");

        try {
            // 1. Identificar contatos duplicados (mesmo nome, mesma empresa, um com ID Meta)
            const [duplicates]: any = await sequelize.query(`
        SELECT 
          c1.id AS meta_contact_id,
          c1.name AS contact_name,
          c1.number AS meta_number,
          c2.id AS real_contact_id,
          c2.number AS real_number,
          c1."companyId"
        FROM "Contacts" c1
        INNER JOIN "Contacts" c2 ON c1.name = c2.name 
          AND c1."companyId" = c2."companyId"
          AND c1.id <> c2.id
          AND c1."isGroup" = false
          AND c2."isGroup" = false
        WHERE 
          LENGTH(REGEXP_REPLACE(c1.number, '[^0-9]', '', 'g')) > 13
          AND LENGTH(REGEXP_REPLACE(c2.number, '[^0-9]', '', 'g')) <= 13
          AND LENGTH(REGEXP_REPLACE(c2.number, '[^0-9]', '', 'g')) >= 10
        ORDER BY c1."companyId", c1.name
      `);

            if (duplicates.length === 0) {
                console.log("[Migration] ✅ Nenhum contato duplicado encontrado");
                return;
            }

            console.log(`[Migration] 📊 Encontrados ${duplicates.length} contatos duplicados para merge`);

            let mergedCount = 0;
            let messagesMovedCount = 0;
            let ticketsMovedCount = 0;
            const processedMetaIds = new Set<number>();

            for (const dup of duplicates) {
                // Evitar processar o mesmo contato Meta duas vezes
                if (processedMetaIds.has(dup.meta_contact_id)) {
                    continue;
                }
                processedMetaIds.add(dup.meta_contact_id);

                try {
                    // 2. Mover tickets do contato Meta para o contato real
                    const [, ticketResult]: any = await sequelize.query(`
            UPDATE "Tickets" 
            SET "contactId" = :realContactId
            WHERE "contactId" = :metaContactId
          `, {
                        replacements: {
                            realContactId: dup.real_contact_id,
                            metaContactId: dup.meta_contact_id
                        }
                    });

                    const ticketsMoved = ticketResult?.rowCount || 0;
                    ticketsMovedCount += ticketsMoved;

                    // 3. Mover mensagens do contato Meta para o contato real
                    const [, messageResult]: any = await sequelize.query(`
            UPDATE "Messages" 
            SET "contactId" = :realContactId
            WHERE "contactId" = :metaContactId
          `, {
                        replacements: {
                            realContactId: dup.real_contact_id,
                            metaContactId: dup.meta_contact_id
                        }
                    });

                    const messagesMoved = messageResult?.rowCount || 0;
                    messagesMovedCount += messagesMoved;

                    // 4. Deletar o contato duplicado (com ID Meta)
                    await sequelize.query(`
            DELETE FROM "Contacts" WHERE id = :metaContactId
          `, {
                        replacements: { metaContactId: dup.meta_contact_id }
                    });

                    mergedCount++;

                    console.log(`[Migration] ✅ Merge: "${dup.contact_name}" (${dup.meta_number} → ${dup.real_number}) - ${ticketsMoved} tickets, ${messagesMoved} mensagens`);

                } catch (err: any) {
                    console.error(`[Migration] ❌ Erro ao fazer merge do contato ${dup.meta_contact_id}: ${err.message}`);
                }
            }

            console.log(`[Migration] 🎉 Merge concluído!`);
            console.log(`[Migration] 📊 Resumo: ${mergedCount} contatos mesclados, ${ticketsMovedCount} tickets movidos, ${messagesMovedCount} mensagens movidas`);

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro na migration de merge: ${error.message}`);
            // Não lançar erro para não bloquear outras migrations
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Esta migration não pode ser revertida pois os contatos duplicados foram deletados
        console.log("[Migration] ⚠️ Esta migration não pode ser revertida (contatos já foram mesclados)");
    }
};
