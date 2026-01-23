
import { QueryTypes } from "sequelize";
import sequelize from "../database";

async function main() {
    const contactName = 'Fernanda Rosa';
    console.log(`\n🔎 Investigando Fluxo do Ticket para: ${contactName} (BUSCA AMPLA)\n`);

    try {
        // 1. Configurações da Empresa (Todas)
        const settings: any[] = await sequelize.query(`
      SELECT * FROM "CompaniesSettings" WHERE "companyId" = 1
    `, { type: QueryTypes.SELECT });

        console.log("⚙️ Configurações:");
        // settings.forEach((s: any) => {
        //     console.log(`   - ${s.key}: ${s.value}`);
        // });
        const direct = settings.find((s: any) => s.key === 'DirectTicketsToWallets');
        console.log(`   - DirectTicketsToWallets: ${direct ? direct.value : 'NÃO DEFINIDO'}`);

        // 2. Buscar TODOS os Contatos com esse nome
        const contacts = await sequelize.query(`
      SELECT id, name, number, "isGroup" FROM "Contacts" WHERE name ILIKE :name
    `, {
            replacements: { name: `%${contactName}%` },
            type: QueryTypes.SELECT
        });

        console.log(`\n👥 Contatos encontrados: ${contacts.length}`);

        for (const contact of contacts as any[]) {
            console.log(`\n   --------------------------------------------------`);
            console.log(`   👤 [${contact.id}] ${contact.name} (${contact.number}) - Grupo: ${contact.isGroup}`);

            // 3. Buscar Carteiras (Wallets)
            const wallets = await sequelize.query(`
            SELECT cw."walletId", u.name as user_name
            FROM "ContactWallets" cw
            JOIN "Users" u ON cw."walletId" = u.id
            WHERE cw."contactId" = :id
        `, { replacements: { id: contact.id }, type: QueryTypes.SELECT });

            if (wallets.length > 0) {
                console.log(`      💼 Wallets: ${wallets.map((w: any) => `${w.user_name} (${w.walletId})`).join(', ')}`);
            } else {
                console.log(`      💼 Wallets: (Nenhuma)`);
            }

            // 4. Buscar Tickets (Abertos ou Recentes)
            const tickets = await sequelize.query(`
            SELECT t.id, t.status, t."userId", u.name as owner_name, t."queueId", q.name as queue_name, t."updatedAt", t."lastMessage"
            FROM "Tickets" t
            LEFT JOIN "Users" u ON t."userId" = u.id
            LEFT JOIN "Queues" q ON t."queueId" = q.id
            WHERE t."contactId" = :id
            ORDER BY t."updatedAt" DESC
            LIMIT 3
        `, { replacements: { id: contact.id }, type: QueryTypes.SELECT });

            if (tickets.length > 0) {
                tickets.forEach((t: any) => {
                    const owner = t.owner_name ? `${t.owner_name} (${t.userId})` : 'SEM DONO';
                    console.log(`      🎫 Ticket ${t.id} [${t.status}]: Dono=${owner}, Fila=${t.queue_name} lastMsg="${t.lastMessage?.substring(0, 20)}..."`);
                });
            } else {
                console.log(`      🎫 Tickets: (Nenhum)`);
            }
        }

        // 5. Listar usuários Felipe e Allan para pegar IDs corretos
        const users = await sequelize.query(`SELECT id, name FROM "Users" WHERE name ILIKE '%Felipe%' OR name ILIKE '%Allan%'`, { type: QueryTypes.SELECT });
        console.log(`\n🆔 IDs de Usuários:`);
        users.forEach((u: any) => console.log(`   - ${u.name}: ${u.id}`));


    } catch (error) {
        console.error("Erro:", error);
    } finally {
        process.exit(0);
    }
}

main();
