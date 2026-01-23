/**
 * Script para investigar contatos Meta e encontrar possíveis matches
 */
import "../bootstrap";
import sequelize from "../database";
import { QueryTypes } from "sequelize";

interface MetaContact {
    id: number;
    name: string;
    number: string;
    companyId: number;
    messageCount: number;
}

interface PossibleMatch {
    id: number;
    name: string;
    number: string;
    similarity: string;
}

async function main() {
    console.log("============================================================");
    console.log("🔍 INVESTIGAÇÃO DE CONTATOS COM IDs META");
    console.log("============================================================\n");

    // Buscar contatos Meta com mensagens
    const metaContacts: MetaContact[] = await sequelize.query(`
    SELECT 
      c.id,
      c.name,
      c.number,
      c."companyId",
      COALESCE((SELECT COUNT(*) FROM "Messages" m WHERE m."contactId" = c.id), 0)::int as "messageCount"
    FROM "Contacts" c
    WHERE c."isGroup" = false
      AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
      AND EXISTS (SELECT 1 FROM "Messages" m WHERE m."contactId" = c.id)
    ORDER BY c.id
  `, { type: QueryTypes.SELECT });

    console.log(`Total de contatos Meta com mensagens: ${metaContacts.length}\n`);

    for (const meta of metaContacts) {
        console.log("------------------------------------------------------------");
        console.log(`📋 ID: ${meta.id} | "${meta.name}" | ${meta.number}`);
        console.log(`   Mensagens: ${meta.messageCount}`);

        // 1. Buscar por nome exato (case insensitive)
        const exactMatches: PossibleMatch[] = await sequelize.query(`
      SELECT id, name, number, 'NOME EXATO' as similarity
      FROM "Contacts"
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))
        AND "companyId" = :companyId
        AND id != :metaId
        AND "isGroup" = false
        AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
    `, {
            replacements: { name: meta.name, companyId: meta.companyId, metaId: meta.id },
            type: QueryTypes.SELECT
        });

        // 2. Buscar por nome parcial (contém)
        const partialMatches: PossibleMatch[] = await sequelize.query(`
      SELECT id, name, number, 'NOME PARCIAL' as similarity
      FROM "Contacts"
      WHERE (
        LOWER(name) LIKE '%' || LOWER(:firstName) || '%'
        OR LOWER(:name) LIKE '%' || LOWER(SPLIT_PART(name, ' ', 1)) || '%'
      )
        AND "companyId" = :companyId
        AND id != :metaId
        AND "isGroup" = false
        AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
      LIMIT 5
    `, {
            replacements: {
                name: meta.name,
                firstName: meta.name.split(' ')[0],
                companyId: meta.companyId,
                metaId: meta.id
            },
            type: QueryTypes.SELECT
        });

        // 3. Buscar mensagens deste contato e ver em quais tickets estão
        const ticketInfo: any[] = await sequelize.query(`
      SELECT DISTINCT 
        t.id as ticket_id,
        t."contactId" as ticket_contact_id,
        tc.name as ticket_contact_name,
        tc.number as ticket_contact_number,
        COUNT(m.id) as msg_count
      FROM "Messages" m
      INNER JOIN "Tickets" t ON m."ticketId" = t.id
      INNER JOIN "Contacts" tc ON t."contactId" = tc.id
      WHERE m."contactId" = :metaId
      GROUP BY t.id, t."contactId", tc.name, tc.number
    `, {
            replacements: { metaId: meta.id },
            type: QueryTypes.SELECT
        });

        // Mostrar resultados
        if (exactMatches.length > 0) {
            console.log("\n   ✅ MATCH EXATO ENCONTRADO:");
            for (const m of exactMatches) {
                console.log(`      → ID ${m.id}: "${m.name}" (${m.number})`);
            }
        }

        if (partialMatches.length > 0 && exactMatches.length === 0) {
            console.log("\n   🔶 MATCHES PARCIAIS:");
            for (const m of partialMatches) {
                console.log(`      → ID ${m.id}: "${m.name}" (${m.number})`);
            }
        }

        if (ticketInfo.length > 0) {
            console.log("\n   📨 TICKETS COM MENSAGENS DESTE CONTATO:");
            for (const t of ticketInfo) {
                if (t.ticket_contact_id !== meta.id) {
                    console.log(`      → Ticket ${t.ticket_id}: Contato "${t.ticket_contact_name}" (${t.ticket_contact_number}) - ${t.msg_count} msgs`);
                } else {
                    console.log(`      → Ticket ${t.ticket_id}: (mesmo contato Meta) - ${t.msg_count} msgs`);
                }
            }
        }

        if (exactMatches.length === 0 && partialMatches.length === 0 && ticketInfo.length === 0) {
            console.log("\n   ⚠️ Nenhum match encontrado");
        }

        console.log();
    }

    // Gerar SQL de merge para matches exatos
    console.log("\n============================================================");
    console.log("💡 COMANDOS SQL PARA MERGE MANUAL:");
    console.log("============================================================\n");

    for (const meta of metaContacts) {
        const exactMatches: any[] = await sequelize.query(`
      SELECT id, name, number
      FROM "Contacts"
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))
        AND "companyId" = :companyId
        AND id != :metaId
        AND "isGroup" = false
        AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
      LIMIT 1
    `, {
            replacements: { name: meta.name, companyId: meta.companyId, metaId: meta.id },
            type: QueryTypes.SELECT
        });

        if (exactMatches.length > 0) {
            const real = exactMatches[0];
            console.log(`-- Merge "${meta.name}" (${meta.id} → ${real.id})`);
            console.log(`UPDATE "Messages" SET "contactId" = ${real.id} WHERE "contactId" = ${meta.id};`);
            console.log(`UPDATE "Tickets" SET "contactId" = ${real.id} WHERE "contactId" = ${meta.id};`);
            console.log(`DELETE FROM "Contacts" WHERE id = ${meta.id};`);
            console.log();
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
