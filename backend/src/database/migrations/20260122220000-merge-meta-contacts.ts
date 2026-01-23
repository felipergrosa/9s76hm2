import { QueryInterface } from "sequelize";

/**
 * Migration Completa: Limpeza de Contatos com IDs Meta
 * 
 * Esta migration realiza 3 passos:
 * 1. MERGE POR NOME: Mescla contatos com IDs Meta que têm correspondente real (mesmo nome)
 * 2. MERGE POR TICKET: Mescla contatos onde mensagens estão em tickets de contatos reais
 * 3. LIMPEZA DE ÓRFÃOS: Deleta contatos com IDs Meta sem tickets/mensagens
 * 
 * Executada automaticamente durante o deploy, uma única vez.
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] 🔧 Iniciando limpeza completa de contatos com IDs Meta...");

        try {
            // ========================================
            // PASSO 1: MERGE POR NOME
            // ========================================
            console.log("[Migration] 📋 Passo 1: Merge por nome...");

            const [duplicatesByName]: any = await sequelize.query(`
        SELECT 
          c1.id AS meta_id,
          c1.name AS name,
          c1.number AS meta_number,
          c2.id AS real_id,
          c2.number AS real_number
        FROM "Contacts" c1
        INNER JOIN "Contacts" c2 ON LOWER(TRIM(c1.name)) = LOWER(TRIM(c2.name))
          AND c1."companyId" = c2."companyId"
          AND c1.id <> c2.id
          AND c1."isGroup" = false
          AND c2."isGroup" = false
        WHERE 
          LENGTH(REGEXP_REPLACE(c1.number, '[^0-9]', '', 'g')) > 13
          AND LENGTH(REGEXP_REPLACE(c2.number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
        ORDER BY c1.id
      `);

            let mergedByName = 0;
            const processedMetaIds = new Set<number>();

            for (const dup of duplicatesByName) {
                if (processedMetaIds.has(dup.meta_id)) continue;
                processedMetaIds.add(dup.meta_id);

                try {
                    // Mover tickets
                    await sequelize.query(`
            UPDATE "Tickets" SET "contactId" = :realId WHERE "contactId" = :metaId
          `, { replacements: { realId: dup.real_id, metaId: dup.meta_id } });

                    // Mover mensagens
                    await sequelize.query(`
            UPDATE "Messages" SET "contactId" = :realId WHERE "contactId" = :metaId
          `, { replacements: { realId: dup.real_id, metaId: dup.meta_id } });

                    // Deletar contato Meta
                    await sequelize.query(`
            DELETE FROM "Contacts" WHERE id = :metaId
          `, { replacements: { metaId: dup.meta_id } });

                    console.log(`[Migration] ✅ Merge: "${dup.name}" (${dup.meta_number} → ${dup.real_number})`);
                    mergedByName++;
                } catch (err: any) {
                    console.error(`[Migration] ❌ Erro merge ID ${dup.meta_id}: ${err.message}`);
                }
            }

            console.log(`[Migration] 📊 Passo 1 concluído: ${mergedByName} contatos mesclados por nome`);

            // ========================================
            // PASSO 2: MERGE POR TICKET
            // ========================================
            console.log("[Migration] 📋 Passo 2: Merge por ticket...");

            const [duplicatesByTicket]: any = await sequelize.query(`
        SELECT DISTINCT 
          meta.id AS meta_id,
          meta.name AS meta_name,
          meta.number AS meta_number,
          real.id AS real_id,
          real.name AS real_name,
          real.number AS real_number
        FROM "Contacts" meta
        INNER JOIN "Messages" m ON m."contactId" = meta.id
        INNER JOIN "Tickets" t ON m."ticketId" = t.id
        INNER JOIN "Contacts" real ON t."contactId" = real.id
        WHERE meta."isGroup" = false
          AND real."isGroup" = false
          AND t."contactId" != meta.id
          AND LENGTH(REGEXP_REPLACE(meta.number, '[^0-9]', '', 'g')) > 13
          AND LENGTH(REGEXP_REPLACE(real.number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
      `);

            let mergedByTicket = 0;

            for (const dup of duplicatesByTicket) {
                if (processedMetaIds.has(dup.meta_id)) continue;
                processedMetaIds.add(dup.meta_id);

                try {
                    // Mover mensagens (já estão no ticket correto, só atualizar contactId)
                    await sequelize.query(`
            UPDATE "Messages" SET "contactId" = :realId WHERE "contactId" = :metaId
          `, { replacements: { realId: dup.real_id, metaId: dup.meta_id } });

                    // Mover tickets restantes
                    await sequelize.query(`
            UPDATE "Tickets" SET "contactId" = :realId WHERE "contactId" = :metaId
          `, { replacements: { realId: dup.real_id, metaId: dup.meta_id } });

                    // Deletar contato Meta
                    await sequelize.query(`
            DELETE FROM "Contacts" WHERE id = :metaId
          `, { replacements: { metaId: dup.meta_id } });

                    console.log(`[Migration] ✅ Merge por ticket: "${dup.meta_name}" → "${dup.real_name}" (${dup.real_number})`);
                    mergedByTicket++;
                } catch (err: any) {
                    console.error(`[Migration] ❌ Erro merge por ticket ID ${dup.meta_id}: ${err.message}`);
                }
            }

            console.log(`[Migration] 📊 Passo 2 concluído: ${mergedByTicket} contatos mesclados por ticket`);

            // ========================================
            // PASSO 3: LIMPEZA DE ÓRFÃOS
            // ========================================
            console.log("[Migration] 📋 Passo 3: Limpeza de órfãos...");

            // Deletar contatos com IDs Meta que não têm tickets nem mensagens
            const [, orphanResult]: any = await sequelize.query(`
        DELETE FROM "Contacts" c
        WHERE c."isGroup" = false
          AND (
            LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
            OR (c.name ~ '^[0-9]+$' AND LENGTH(c.name) > 13)
          )
          AND NOT EXISTS (SELECT 1 FROM "Tickets" t WHERE t."contactId" = c.id)
          AND NOT EXISTS (SELECT 1 FROM "Messages" m WHERE m."contactId" = c.id)
      `);

            const orphansDeleted = orphanResult?.rowCount || 0;
            console.log(`[Migration] 📊 Passo 3 concluído: ${orphansDeleted} contatos órfãos deletados`);

            // ========================================
            // RESUMO FINAL
            // ========================================
            console.log("[Migration] 🎉 Limpeza completa concluída!");
            console.log(`[Migration] 📊 Resumo: ${mergedByName} por nome, ${mergedByTicket} por ticket, ${orphansDeleted} órfãos deletados`);

            // Verificar se ainda há contatos com IDs Meta
            const [remaining]: any = await sequelize.query(`
        SELECT COUNT(*) as count FROM "Contacts" c
        WHERE c."isGroup" = false
          AND (
            LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
            OR (c.name ~ '^[0-9]+$' AND LENGTH(c.name) > 13)
          )
      `);

            if (remaining[0]?.count > 0) {
                console.log(`[Migration] ⚠️ Ainda restam ${remaining[0].count} contatos com IDs Meta (precisam análise manual)`);
            } else {
                console.log("[Migration] ✅ Todos os contatos com IDs Meta foram limpos!");
            }

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro geral: ${error.message}`);
            // Não lançar erro para não bloquear outras migrations
        }
    },

    down: async () => {
        console.log("[Migration] ⚠️ Esta migration não pode ser revertida (dados já foram mesclados/deletados)");
    }
};
