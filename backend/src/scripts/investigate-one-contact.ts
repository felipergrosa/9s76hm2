
import { QueryTypes } from "sequelize";
import sequelize from "../database";

async function main() {
    const targetNumber = '169565493436576';
    console.log(`\n🔎 Investigando QUALQUER contato com número: ${targetNumber}\n`);

    try {
        const contacts = await sequelize.query(`
      SELECT * FROM "Contacts" WHERE number LIKE :number
    `, {
            replacements: { number: `%${targetNumber}%` },
            type: QueryTypes.SELECT
        });

        if (contacts.length === 0) {
            console.log("❌ NENHUM contato encontrado com esse número (nem grupo, nem pessoa).");
        } else {
            console.log("✅ Contato(s) encontrado(s):");
            contacts.forEach((c: any) => {
                console.log(JSON.stringify(c, null, 2));
            });
        }

    } catch (error) {
        console.error("Erro:", error);
    } finally {
        process.exit(0);
    }
}

main();
