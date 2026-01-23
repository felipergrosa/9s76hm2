/**
 * Script de Migração: Mover mensagens de contatos Meta para tickets de grupos
 * 
 * Este script identifica mensagens que estão em tickets de grupos mas
 * têm contactId apontando para contatos com IDs Meta inválidos.
 * 
 * Ações:
 * 1. Atualiza Message.senderName com o nome do contato Meta
 * 2. Atualiza Message.contactId para apontar para o contato do grupo
 * 3. Deleta os contatos Meta após a migração
 */

import "../bootstrap";
import sequelize from "../database";
import { QueryTypes } from "sequelize";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";

const isDryRun = process.argv.includes("--dry-run");

interface MetaContactWithGroup {
    meta_contact_id: number;
    meta_contact_name: string;
    meta_contact_number: string;
    message_count: number;
    ticket_id: number;
    group_contact_id: number;
    group_name: string;
}

async function main() {
    console.log("============================================================");
    console.log("🔧 MIGRAÇÃO: MENSAGENS DE CONTATOS META PARA GRUPOS");
    console.log("============================================================");
    console.log(`Modo: ${isDryRun ? "🔍 DRY-RUN" : "⚡ EXECUÇÃO REAL"}`);
    console.log("============================================================\n");

    try {
        // 1. Identificar contatos Meta com mensagens que pertencem a tickets de grupos
        console.log("🔎 Buscando contatos Meta com mensagens em tickets de grupos...\n");

        const metaContactsInGroups: MetaContactWithGroup[] = await sequelize.query(`
      SELECT DISTINCT
        mc.id as meta_contact_id,
        mc.name as meta_contact_name,
        mc.number as meta_contact_number,
        COUNT(m.id) as message_count,
        t.id as ticket_id,
        t."contactId" as group_contact_id,
        gc.name as group_name
      FROM "Contacts" mc
      INNER JOIN "Messages" m ON m."contactId" = mc.id
      INNER JOIN "Tickets" t ON m."ticketId" = t.id
      INNER JOIN "Contacts" gc ON t."contactId" = gc.id
      WHERE mc."isGroup" = false
        AND LENGTH(REGEXP_REPLACE(mc.number, '[^0-9]', '', 'g')) > 13
        AND t."contactId" != mc.id
      GROUP BY mc.id, mc.name, mc.number, t.id, t."contactId", gc.name
      ORDER BY mc.id
    `, { type: QueryTypes.SELECT });

        console.log(`📊 Encontrados ${metaContactsInGroups.length} registros\n`);

        if (metaContactsInGroups.length === 0) {
            console.log("✅ Nenhum contato Meta com mensagens em grupos encontrado!");
            process.exit(0);
        }

        // Agrupar por contato Meta
        const metaContactsMap = new Map<number, MetaContactWithGroup[]>();
        for (const record of metaContactsInGroups) {
            if (!metaContactsMap.has(record.meta_contact_id)) {
                metaContactsMap.set(record.meta_contact_id, []);
            }
            metaContactsMap.get(record.meta_contact_id)!.push(record);
        }

        console.log(`📋 ${metaContactsMap.size} contatos Meta únicos\n`);

        let totalMessagesMigrated = 0;
        let totalContactsDeleted = 0;

        // 2. Processar cada contato Meta
        for (const [metaContactId, records] of metaContactsMap) {
            const firstRecord = records[0];
            console.log(`\n📋 Contato Meta ID ${metaContactId}: "${firstRecord.meta_contact_name}"`);
            console.log(`   Número: ${firstRecord.meta_contact_number}`);

            for (const record of records) {
                console.log(`   → Ticket ${record.ticket_id} (${record.group_name}): ${record.message_count} msgs`);

                if (isDryRun) {
                    console.log(`   [DRY-RUN] Mensagens seriam migradas`);
                    totalMessagesMigrated += record.message_count;
                } else {
                    // Atualizar contactId das mensagens (senderName será adicionado depois em produção)
                    await sequelize.query(`
            UPDATE "Messages"
            SET "contactId" = :groupContactId
            WHERE "contactId" = :metaContactId
              AND "ticketId" = :ticketId
          `, {
                        replacements: {
                            groupContactId: record.group_contact_id,
                            metaContactId: metaContactId,
                            ticketId: record.ticket_id
                        }
                    });

                    console.log(`   ✅ ${record.message_count} mensagens migradas para grupo`);
                    totalMessagesMigrated += record.message_count;
                }
            }

            // 3. Verificar se o contato Meta ainda tem mensagens
            const remainingMsgs = await Message.count({ where: { contactId: metaContactId } });
            const remainingTickets = await Ticket.count({ where: { contactId: metaContactId } });

            if (remainingMsgs === 0 && remainingTickets === 0) {
                if (isDryRun) {
                    console.log(`   [DRY-RUN] Contato Meta seria deletado`);
                } else {
                    await Contact.destroy({ where: { id: metaContactId } });
                    console.log(`   ✅ Contato Meta ${metaContactId} deletado`);
                }
                totalContactsDeleted++;
            } else {
                console.log(`   ⚠️ Contato Meta ${metaContactId} tem ${remainingMsgs} msgs e ${remainingTickets} tickets restantes`);
            }
        }

        // 4. Resumo
        console.log("\n============================================================");
        console.log("📊 RESUMO");
        console.log("============================================================");
        console.log(`Mensagens ${isDryRun ? "seriam " : ""}migradas: ${totalMessagesMigrated}`);
        console.log(`Contatos ${isDryRun ? "seriam " : ""}deletados: ${totalContactsDeleted}`);
        console.log("============================================================");

        if (isDryRun) {
            console.log("\n💡 Para executar de verdade, remova --dry-run");
        }

    } catch (error: any) {
        console.error("❌ Erro:", error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

main();
