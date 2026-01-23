import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Migration de Correção e Limpeza FINAL:
 * (Substitui a anterior que falhou devido a um erro de sintaxe no deploy)
 * 
 * Esta migration faz 3 coisas:
 * 1. Move mensagens de contatos Meta para os tickets de grupo corretos
 * 2. Mescla contatos duplicados (mesmo nome)
 * 3. Deleta contatos órfãos
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] 🔧 Iniciando (RETRY) limpeza FINAL de contatos com IDs Meta...");

        try {
            // ========================================
            // PASSO 1: Migrar mensagens de grupos
            // ========================================
            console.log("[Migration] 📋 Passo 1: Migrando mensagens de contatos Meta em grupos...");

            // CORREÇÃO: Removido destructuring [metaInGroups] pois QueryTypes.SELECT retorna o array direto
            const metaInGroups: any = await sequelize.query(`
        SELECT DISTINCT
          mc.id as meta_id,
          mc.name as meta_name,
          t.id as ticket_id,
          t."contactId" as group_contact_id
        FROM "Contacts" mc
        INNER JOIN "Messages" m ON m."contactId" = mc.id
        INNER JOIN "Tickets" t ON m."ticketId" = t.id
        WHERE mc."isGroup" = false
          AND LENGTH(REGEXP_REPLACE(mc.number, '[^0-9]', '', 'g')) > 13
          AND t."contactId" != mc.id
      `, { type: QueryTypes.SELECT });

            console.log(`[Migration] Encontrados ${metaInGroups?.length || 0} contatos Meta em tickets de grupos`);

            const processedMeta = new Set<number>();
            let migratedMessages = 0;
            let deletedContacts = 0;

            if (metaInGroups && metaInGroups.length > 0) {
                for (const record of metaInGroups) {
                    if (processedMeta.has(record.meta_id)) continue;
                    processedMeta.add(record.meta_id);

                    try {
                        // Mover mensagens para o contato do grupo
                        const [, updateResult]: any = await sequelize.query(`
              UPDATE "Messages"
              SET "contactId" = :groupContactId,
                  "senderName" = :senderName
              WHERE "contactId" = :metaId
            `, {
                            replacements: {
                                groupContactId: record.group_contact_id,
                                metaId: record.meta_id,
                                senderName: record.meta_name
                            }
                        });

                        migratedMessages += updateResult?.rowCount || 0;

                        // Deletar contato Meta (se não tiver mais referências)
                        await sequelize.query(`
              DELETE FROM "Contacts" 
              WHERE id = :metaId
                AND NOT EXISTS (SELECT 1 FROM "Messages" WHERE "contactId" = :metaId)
                AND NOT EXISTS (SELECT 1 FROM "Tickets" WHERE "contactId" = :metaId)
            `, { replacements: { metaId: record.meta_id } });

                        console.log(`[Migration] ✅ Migradas mensagens de "${record.meta_name}" para grupo`);
                        deletedContacts++;
                    } catch (err: any) {
                        console.log(`[Migration] ⚠️ Erro ao migrar ${record.meta_id}: ${err.message}`);
                    }
                }
            }

            console.log(`[Migration] 📊 Passo 1: ${migratedMessages} mensagens migradas`);

            // ========================================
            // PASSO 2: Merge por nome
            // ========================================
            console.log("[Migration] 📋 Passo 2: Mesclando contatos duplicados por nome...");

            // CORREÇÃO: Removido destructuring [duplicates]
            const duplicates: any = await sequelize.query(`
        SELECT 
          c1.id AS meta_id,
          c1.name AS name,
          c2.id AS real_id
        FROM "Contacts" c1
        INNER JOIN "Contacts" c2 ON LOWER(TRIM(c1.name)) = LOWER(TRIM(c2.name))
          AND c1."companyId" = c2."companyId"
          AND c1.id <> c2.id
          AND c1."isGroup" = false
          AND c2."isGroup" = false
        WHERE 
          LENGTH(REGEXP_REPLACE(c1.number, '[^0-9]', '', 'g')) > 13
          AND LENGTH(REGEXP_REPLACE(c2.number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
      `, { type: QueryTypes.SELECT });

            let mergedByName = 0;

            if (duplicates && duplicates.length > 0) {
                for (const dup of duplicates) {
                    if (processedMeta.has(dup.meta_id)) continue;
                    processedMeta.add(dup.meta_id);

                    try {
                        await sequelize.query(`UPDATE "Tickets" SET "contactId" = :realId WHERE "contactId" = :metaId`,
                            { replacements: { realId: dup.real_id, metaId: dup.meta_id } });
                        await sequelize.query(`UPDATE "Messages" SET "contactId" = :realId WHERE "contactId" = :metaId`,
                            { replacements: { realId: dup.real_id, metaId: dup.meta_id } });
                        await sequelize.query(`DELETE FROM "Contacts" WHERE id = :metaId`,
                            { replacements: { metaId: dup.meta_id } });

                        console.log(`[Migration] ✅ Merge: "${dup.name}"`);
                        mergedByName++;
                    } catch (err: any) {
                        console.log(`[Migration] ⚠️ Erro merge ${dup.meta_id}: ${err.message}`);
                    }
                }
            }

            console.log(`[Migration] 📊 Passo 2: ${mergedByName} contatos mesclados`);

            // ========================================
            // PASSO 3: Deletar órfãos
            // ========================================
            console.log("[Migration] 📋 Passo 3: Deletando contatos órfãos...");

            // Para DELETE raw (sem QueryTypes.SELECT), o retorno padrão é [results, metadata]
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
            console.log(`[Migration] 📊 Passo 3: ${orphansDeleted} órfãos deletados`);

            // Resumo
            console.log("[Migration] 🎉 Limpeza FINAL (RETRY) concluída!");
            console.log(`[Migration] 📊 Total: ${migratedMessages} msgs migradas, ${mergedByName} mesclados, ${orphansDeleted} órfãos deletados`);

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro: ${error.message}`);
        }
    },

    down: async () => {
        console.log("[Migration] ⚠️ Esta migration não pode ser revertida");
    }
};
