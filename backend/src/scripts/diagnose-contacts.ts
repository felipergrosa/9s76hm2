/**
 * Script simples para diagnosticar contatos com IDs Meta
 */
import "../bootstrap";
import sequelize from "../database";
import { QueryTypes } from "sequelize";

async function main() {
    console.log("Buscando contatos com IDs Meta...\n");

    const results: any[] = await sequelize.query(`
    SELECT id, name, number, "companyId"
    FROM "Contacts"
    WHERE "isGroup" = false
      AND (
        LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 13
        OR (name ~ '^[0-9]+$' AND LENGTH(name) > 13)
      )
    ORDER BY id
  `, { type: QueryTypes.SELECT });

    console.log(`Total encontrados: ${results.length}\n`);

    for (const r of results) {
        console.log(`ID: ${r.id} | Company: ${r.companyId} | Nome: "${r.name.substring(0, 40)}" | Número: ${r.number}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
