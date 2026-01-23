/**
 * Script para listar contatos com IDs Meta de forma detalhada
 */
import "../bootstrap";
import sequelize from "../database";
import { QueryTypes } from "sequelize";

async function main() {
  console.log("============================================================");
  console.log("📊 RELATÓRIO DE CONTATOS COM IDs META");
  console.log("============================================================\n");

  const results: any[] = await sequelize.query(`
    SELECT 
      c.id, 
      c.name,
      c.number,
      c."companyId",
      COALESCE((SELECT COUNT(*) FROM "Tickets" t WHERE t."contactId" = c.id), 0)::int as "ticketCount",
      COALESCE((SELECT COUNT(*) FROM "Messages" m WHERE m."contactId" = c.id), 0)::int as "messageCount"
    FROM "Contacts" c
    WHERE c."isGroup" = false
      AND (
        LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
        OR (c.name ~ '^[0-9]+$' AND LENGTH(c.name) > 13)
      )
    ORDER BY c.id
  `, { type: QueryTypes.SELECT });

  console.log(`Total de contatos com IDs Meta: ${results.length}\n`);

  if (results.length === 0) {
    console.log("✅ Nenhum contato com ID Meta encontrado!\n");
    process.exit(0);
  }

  // Categorizar
  const withData = results.filter(r => r.ticketCount > 0 || r.messageCount > 0);
  const orphans = results.filter(r => r.ticketCount === 0 && r.messageCount === 0);
  const numericNames = results.filter(r => /^\d+$/.test(r.name) && r.name.length > 13);

  console.log("------------------------------------------------------------");
  console.log("CONTATOS COM TICKETS/MENSAGENS (precisam merge manual):");
  console.log("------------------------------------------------------------");
  if (withData.length === 0) {
    console.log("  Nenhum\n");
  } else {
    for (const r of withData) {
      const nameShort = r.name.length > 40 ? r.name.substring(0, 40) + "..." : r.name;
      console.log(`  ID: ${r.id} | "${nameShort}"`);
      console.log(`     Número: ${r.number} | Tickets: ${r.ticketCount} | Msgs: ${r.messageCount}`);
    }
    console.log();
  }

  console.log("------------------------------------------------------------");
  console.log("CONTATOS ÓRFÃOS (podem ser deletados diretamente):");
  console.log("------------------------------------------------------------");
  if (orphans.length === 0) {
    console.log("  Nenhum\n");
  } else {
    for (const r of orphans) {
      const nameShort = r.name.length > 40 ? r.name.substring(0, 40) + "..." : r.name;
      console.log(`  ID: ${r.id} | "${nameShort}" | ${r.number}`);
    }
    console.log();
  }

  console.log("------------------------------------------------------------");
  console.log("CONTATOS COM NOME = ID META:");
  console.log("------------------------------------------------------------");
  if (numericNames.length === 0) {
    console.log("  Nenhum\n");
  } else {
    for (const r of numericNames) {
      console.log(`  ID: ${r.id} | Nome/Número: ${r.number} | Tickets: ${r.ticketCount} | Msgs: ${r.messageCount}`);
    }
    console.log();
  }

  // Comandos SQL para ações manuais
  if (orphans.length > 0) {
    console.log("============================================================");
    console.log("💡 SQL PARA DELETAR ÓRFÃOS:");
    console.log("============================================================");
    console.log(`DELETE FROM "Contacts" WHERE id IN (${orphans.map(o => o.id).join(", ")});\n`);
  }

  if (withData.length > 0) {
    console.log("============================================================");
    console.log("⚠️ CONTATOS QUE PRECISAM ANÁLISE MANUAL:");
    console.log("============================================================");
    console.log("Estes contatos têm tickets/mensagens e precisam ser");
    console.log("mesclados manualmente com o contato correto.\n");
    console.log("Use este SQL para investigar:");
    console.log(`
SELECT c.id, c.name, c.number, t.id as ticket_id, t.status
FROM "Contacts" c
LEFT JOIN "Tickets" t ON t."contactId" = c.id
WHERE c.id IN (${withData.map(w => w.id).join(", ")});
`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
