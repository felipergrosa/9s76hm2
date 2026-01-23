import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Migration de Diagnóstico: Listar contatos Meta RESISTENTES
 * 
 * Esta migration não altera dados, apenas lista no log os contatos 
 * que sobreviveram às limpezas anteriores para entendermos o porquê.
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] 🔍 DIAGNÓSTICO: Investigando contatos Meta restantes...");

        try {
            // Listar contatos Meta que ainda existem
            const survivors: any = await sequelize.query(`
        SELECT 
          c.id, 
          c.name, 
          c.number, 
          (SELECT COUNT(*) FROM "Tickets" t WHERE t."contactId" = c.id) as ticket_count,
          (SELECT COUNT(*) FROM "Messages" m WHERE m."contactId" = c.id) as msg_count
        FROM "Contacts" c
        WHERE c."isGroup" = false
          AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
      `, { type: QueryTypes.SELECT });

            if (survivors.length === 0) {
                console.log("[Migration] ✅ Nenhum contato Meta encontrado!");
            } else {
                console.log(`[Migration] ⚠️  Encontrados ${survivors.length} contatos Meta resistentes:`);

                for (const c of survivors) {
                    console.log(`[Migration]    👉 [${c.id}] ${c.name} (${c.number})`);
                    console.log(`[Migration]       Tickets: ${c.ticket_count} | Msgs: ${c.msg_count}`);

                    // Se tiver ticket, verifique detalhes do ticket
                    if (c.ticket_count > 0) {
                        const tickets: any = await sequelize.query(`
              SELECT id, status, "isGroup", "updatedAt" FROM "Tickets" WHERE "contactId" = :id
            `, { replacements: { id: c.id }, type: QueryTypes.SELECT });

                        tickets.forEach((t: any) => {
                            console.log(`[Migration]       TicketID: ${t.id} Status: ${t.status} Grupo: ${t.isGroup} Última: ${t.updatedAt}`);
                        });
                    }
                }

                console.log("[Migration] 💡 CONCLUSÃO: Estes contatos não foram deletados porque têm Tickets ou Mensagens associados diretamente a eles.");
            }

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro: ${error.message}`);
        }
    },

    down: async () => {
        console.log("[Migration] Diagnóstico executado.");
    }
};
