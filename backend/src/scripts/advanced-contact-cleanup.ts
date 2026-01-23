/**
 * Script Avançado de Limpeza de Contatos com IDs Meta
 * 
 * Detecta DOIS tipos de problemas:
 * 1. Contatos duplicados por NOME (mesmo nome, um com ID Meta, outro válido)
 * 2. Contatos onde o NOME é o próprio ID Meta (número numérico > 13 dígitos como nome)
 * 
 * USO:
 *   npx ts-node src/scripts/advanced-contact-cleanup.ts --dry-run
 *   npx ts-node src/scripts/advanced-contact-cleanup.ts
 *   npx ts-node src/scripts/advanced-contact-cleanup.ts --company-id=1
 */

import "../bootstrap";
import sequelize from "../database";
import { QueryTypes } from "sequelize";

interface MetaContact {
    id: number;
    name: string;
    number: string;
    companyId: number;
    ticketCount: number;
    messageCount: number;
}

interface CleanupResult {
    contactId: number;
    name: string;
    number: string;
    action: "merged" | "deleted" | "skipped";
    targetContactId?: number;
    targetNumber?: string;
    targetName?: string;
    ticketsMoved: number;
    messagesMoved: number;
    error?: string;
}

const isDryRun = process.argv.includes("--dry-run");
const companyIdArg = process.argv.find(arg => arg.startsWith("--company-id="));
const specificCompanyId = companyIdArg ? parseInt(companyIdArg.split("=")[1]) : null;

async function main() {
    console.log("============================================================");
    console.log("🔧 SCRIPT AVANÇADO DE LIMPEZA DE CONTATOS META");
    console.log("============================================================");
    console.log(`Modo: ${isDryRun ? "🔍 DRY-RUN (apenas simulação)" : "⚡ EXECUÇÃO REAL"}`);
    console.log(`Empresa: ${specificCompanyId || "TODAS"}`);
    console.log("============================================================\n");

    const results: CleanupResult[] = [];

    try {
        // 1. Encontrar contatos com IDs Meta (número OU nome > 13 dígitos numéricos)
        console.log("🔎 Buscando contatos com IDs Meta...\n");

        const companyFilter = specificCompanyId ? `AND "companyId" = ${specificCompanyId}` : "";

        const metaContacts: MetaContact[] = await sequelize.query(`
      SELECT 
        c.id,
        c.name,
        c.number,
        c."companyId",
        COALESCE((SELECT COUNT(*) FROM "Tickets" t WHERE t."contactId" = c.id), 0) as "ticketCount",
        COALESCE((SELECT COUNT(*) FROM "Messages" m WHERE m."contactId" = c.id), 0) as "messageCount"
      FROM "Contacts" c
      WHERE c."isGroup" = false
        AND (
          -- Número é ID Meta (> 13 dígitos numéricos)
          LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
          -- OU Nome é numérico e > 13 dígitos (nome = ID Meta)
          OR (c.name ~ '^[0-9]+$' AND LENGTH(c.name) > 13)
        )
        ${companyFilter}
      ORDER BY c."companyId", c.name
    `, { type: QueryTypes.SELECT });

        console.log(`📊 Encontrados ${metaContacts.length} contatos com IDs Meta\n`);

        if (metaContacts.length === 0) {
            console.log("✅ Nenhum contato para limpar!");
            return;
        }

        // 2. Processar cada contato
        for (const contact of metaContacts) {
            const result = await processMetaContact(contact);
            results.push(result);
        }

        // 3. Resumo
        printSummary(results);

    } catch (error: any) {
        console.error("❌ Erro fatal:", error.message);
        console.error(error.stack);
    }
}

async function processMetaContact(contact: MetaContact): Promise<CleanupResult> {
    const result: CleanupResult = {
        contactId: contact.id,
        name: contact.name,
        number: contact.number,
        action: "skipped",
        ticketsMoved: 0,
        messagesMoved: 0
    };

    console.log(`\n📋 Contato ID ${contact.id}: "${contact.name}" (${contact.number})`);
    console.log(`   Company: ${contact.companyId}, Tickets: ${contact.ticketCount}, Msgs: ${contact.messageCount}`);

    try {
        // Estratégia 1: Verificar se há um contato duplicado por nome
        const duplicateByName = await findDuplicateByName(contact);
        if (duplicateByName) {
            console.log(`   ✅ Encontrado duplicado por nome: "${duplicateByName.name}" (${duplicateByName.number})`);
            return await mergeContacts(contact, duplicateByName);
        }

        // Estratégia 2: Se o nome é o próprio ID Meta, procurar contato real pelo ticket
        if (isNameMetaId(contact.name)) {
            console.log(`   🔍 Nome é ID Meta, buscando contato real por tickets...`);

            const realContactFromTicket = await findRealContactFromTicketMessages(contact);
            if (realContactFromTicket) {
                console.log(`   ✅ Encontrado contato real pelo ticket: "${realContactFromTicket.name}" (${realContactFromTicket.number})`);
                return await mergeContacts(contact, realContactFromTicket);
            }

            // Se não tem tickets nem mensagens, pode deletar
            if (contact.ticketCount === 0 && contact.messageCount === 0) {
                console.log(`   🗑️ Contato órfão sem dados - pode ser deletado`);
                return await deleteOrphanContact(contact);
            }
        }

        console.log(`   ⚠️ Nenhum match encontrado - mantido para análise manual`);
        return result;

    } catch (error: any) {
        console.error(`   ❌ Erro: ${error.message}`);
        result.error = error.message;
        return result;
    }
}

function isNameMetaId(name: string): boolean {
    const digitsOnly = name.replace(/\D/g, "");
    return digitsOnly.length > 13 && digitsOnly === name.trim();
}

async function findDuplicateByName(contact: MetaContact): Promise<any> {
    const results: any[] = await sequelize.query(`
    SELECT id, name, number
    FROM "Contacts"
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))
      AND "companyId" = :companyId
      AND id != :contactId
      AND "isGroup" = false
      AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
    LIMIT 1
  `, {
        replacements: {
            name: contact.name,
            companyId: contact.companyId,
            contactId: contact.id
        },
        type: QueryTypes.SELECT
    });

    return results.length > 0 ? results[0] : null;
}

async function findRealContactFromTicketMessages(metaContact: MetaContact): Promise<any> {
    // Encontrar mensagens deste contato que estão em tickets de OUTROS contatos
    const results: any[] = await sequelize.query(`
    SELECT DISTINCT c.id, c.name, c.number
    FROM "Messages" m
    INNER JOIN "Tickets" t ON m."ticketId" = t.id
    INNER JOIN "Contacts" c ON t."contactId" = c.id
    WHERE m."contactId" = :metaContactId
      AND t."contactId" != :metaContactId
      AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
    LIMIT 1
  `, {
        replacements: { metaContactId: metaContact.id },
        type: QueryTypes.SELECT
    });

    return results.length > 0 ? results[0] : null;
}

async function mergeContacts(metaContact: MetaContact, realContact: any): Promise<CleanupResult> {
    const result: CleanupResult = {
        contactId: metaContact.id,
        name: metaContact.name,
        number: metaContact.number,
        action: "merged",
        targetContactId: realContact.id,
        targetNumber: realContact.number,
        targetName: realContact.name,
        ticketsMoved: 0,
        messagesMoved: 0
    };

    if (isDryRun) {
        console.log(`   [DRY-RUN] Seria mesclado → "${realContact.name}" (${realContact.number})`);
        result.ticketsMoved = metaContact.ticketCount;
        result.messagesMoved = metaContact.messageCount;
        return result;
    }

    // Mover tickets
    const [, ticketResult]: any = await sequelize.query(`
    UPDATE "Tickets" SET "contactId" = :realId WHERE "contactId" = :metaId
  `, { replacements: { realId: realContact.id, metaId: metaContact.id } });

    result.ticketsMoved = ticketResult?.rowCount || 0;
    if (result.ticketsMoved > 0) {
        console.log(`   ✅ ${result.ticketsMoved} tickets movidos`);
    }

    // Mover mensagens
    const [, messageResult]: any = await sequelize.query(`
    UPDATE "Messages" SET "contactId" = :realId WHERE "contactId" = :metaId
  `, { replacements: { realId: realContact.id, metaId: metaContact.id } });

    result.messagesMoved = messageResult?.rowCount || 0;
    if (result.messagesMoved > 0) {
        console.log(`   ✅ ${result.messagesMoved} mensagens movidas`);
    }

    // Deletar contato Meta
    await sequelize.query(`DELETE FROM "Contacts" WHERE id = :metaId`, {
        replacements: { metaId: metaContact.id }
    });
    console.log(`   ✅ Contato ${metaContact.id} removido`);

    return result;
}

async function deleteOrphanContact(contact: MetaContact): Promise<CleanupResult> {
    const result: CleanupResult = {
        contactId: contact.id,
        name: contact.name,
        number: contact.number,
        action: "deleted",
        ticketsMoved: 0,
        messagesMoved: 0
    };

    if (isDryRun) {
        console.log(`   [DRY-RUN] Seria deletado (órfão)`);
        return result;
    }

    await sequelize.query(`DELETE FROM "Contacts" WHERE id = :contactId`, {
        replacements: { contactId: contact.id }
    });
    console.log(`   ✅ Contato órfão deletado`);

    return result;
}

function printSummary(results: CleanupResult[]) {
    console.log("\n============================================================");
    console.log("📊 RESUMO FINAL");
    console.log("============================================================");

    const merged = results.filter(r => r.action === "merged");
    const deleted = results.filter(r => r.action === "deleted");
    const skipped = results.filter(r => r.action === "skipped");
    const errors = results.filter(r => r.error);

    const totalTickets = results.reduce((sum, r) => sum + r.ticketsMoved, 0);
    const totalMessages = results.reduce((sum, r) => sum + r.messagesMoved, 0);

    console.log(`Total processados: ${results.length}`);
    console.log(`${isDryRun ? "Seriam mesclados" : "Mesclados"}: ${merged.length}`);
    console.log(`${isDryRun ? "Seriam deletados" : "Deletados"}: ${deleted.length}`);
    console.log(`Ignorados (análise manual): ${skipped.length}`);
    console.log(`Tickets ${isDryRun ? "seriam " : ""}movidos: ${totalTickets}`);
    console.log(`Mensagens ${isDryRun ? "seriam " : ""}movidas: ${totalMessages}`);
    console.log(`Erros: ${errors.length}`);
    console.log("============================================================");

    if (skipped.length > 0) {
        console.log("\n⚠️ CONTATOS QUE PRECISAM DE ANÁLISE MANUAL:");
        console.log("------------------------------------------------------------");
        for (const s of skipped) {
            console.log(`  ID: ${s.contactId} | Nome: "${s.name}" | Número: ${s.number}`);
        }
        console.log("------------------------------------------------------------");
        console.log("Estes contatos não puderam ser automaticamente vinculados.");
        console.log("Você pode usar o seguinte SQL para investigar manualmente:");
        console.log(`  SELECT id, name, number FROM "Contacts" WHERE id IN (${skipped.map(s => s.contactId).join(", ")})`);
    }

    if (isDryRun) {
        console.log("\n💡 Para executar de verdade, remova --dry-run");
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Erro fatal:", err);
        process.exit(1);
    });
