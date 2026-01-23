/**
 * Script de Limpeza: Merge de Contatos Duplicados
 * 
 * Este script identifica contatos com IDs Meta (> 13 dígitos) e tenta
 * fazer merge com o contato real (mesmo nome, número válido).
 * 
 * USO:
 *   npx ts-node src/scripts/merge-duplicate-contacts.ts [--dry-run] [--company-id=X]
 * 
 * OPÇÕES:
 *   --dry-run      Apenas mostra o que seria feito, sem executar
 *   --company-id=X Processar apenas uma empresa específica
 */

import "../bootstrap";
import sequelize from "../database";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import { Op, QueryTypes } from "sequelize";
import logger from "../utils/logger";

interface DuplicateContact {
    meta_contact_id: number;
    name: string;
    meta_number: string;
    meta_length: number;
    real_contact_id: number;
    real_number: string;
    real_length: number;
    companyId: number;
}

interface Stats {
    found: number;
    merged: number;
    ticketsMoved: number;
    messagesMoved: number;
    errors: number;
}

const parseArgs = () => {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");

    let companyId: number | null = null;
    const companyArg = args.find(a => a.startsWith("--company-id="));
    if (companyArg) {
        companyId = parseInt(companyArg.split("=")[1], 10);
        if (isNaN(companyId)) companyId = null;
    }

    return { dryRun, companyId };
};

const findDuplicates = async (companyId: number | null): Promise<DuplicateContact[]> => {
    let whereClause = "";
    if (companyId) {
        whereClause = `AND c1."companyId" = ${companyId}`;
    }

    const query = `
    SELECT 
      c1.id AS meta_contact_id,
      c1.name,
      c1.number AS meta_number,
      LENGTH(c1.number) AS meta_length,
      c2.id AS real_contact_id,
      c2.number AS real_number,
      LENGTH(c2.number) AS real_length,
      c1."companyId"
    FROM "Contacts" c1
    INNER JOIN "Contacts" c2 
      ON LOWER(TRIM(c1.name)) = LOWER(TRIM(c2.name))
      AND c1."companyId" = c2."companyId"
      AND c1.id <> c2.id
      AND c1."isGroup" = false 
      AND c2."isGroup" = false
    WHERE LENGTH(c1.number) > 13
      AND LENGTH(c2.number) <= 13
      ${whereClause}
    ORDER BY c1."companyId", c1.name
  `;

    const results = await sequelize.query(query, {
        type: QueryTypes.SELECT
    }) as any[];

    return results.map(r => ({
        meta_contact_id: r.meta_contact_id,
        name: r.name,
        meta_number: r.meta_number,
        meta_length: parseInt(r.meta_length, 10),
        real_contact_id: r.real_contact_id,
        real_number: r.real_number,
        real_length: parseInt(r.real_length, 10),
        companyId: r.companyId
    }));
};

const mergeContact = async (
    duplicate: DuplicateContact,
    stats: Stats,
    dryRun: boolean
): Promise<void> => {
    const { meta_contact_id, real_contact_id, name, meta_number, real_number, companyId } = duplicate;

    console.log(`\n📋 Processando: "${name}"`);
    console.log(`   Meta ID: ${meta_contact_id} (${meta_number})`);
    console.log(`   Real ID: ${real_contact_id} (${real_number})`);

    try {
        // Contar tickets e mensagens
        const ticketCount = await Ticket.count({ where: { contactId: meta_contact_id } });
        const messageCount = await Message.count({ where: { contactId: meta_contact_id } });

        console.log(`   Tickets: ${ticketCount}, Mensagens: ${messageCount}`);

        if (dryRun) {
            console.log(`   [DRY-RUN] Seria feito merge → ${real_contact_id}`);
            stats.merged++;
            stats.ticketsMoved += ticketCount;
            stats.messagesMoved += messageCount;
            return;
        }

        // Iniciar transação
        await sequelize.transaction(async (t) => {
            // 1. Mover tickets para o contato real
            if (ticketCount > 0) {
                await Ticket.update(
                    { contactId: real_contact_id },
                    { where: { contactId: meta_contact_id }, transaction: t }
                );
                console.log(`   ✅ ${ticketCount} tickets movidos`);
                stats.ticketsMoved += ticketCount;
            }

            // 2. Mover mensagens para o contato real
            if (messageCount > 0) {
                await Message.update(
                    { contactId: real_contact_id },
                    { where: { contactId: meta_contact_id }, transaction: t }
                );
                console.log(`   ✅ ${messageCount} mensagens movidas`);
                stats.messagesMoved += messageCount;
            }

            // 3. Deletar contato duplicado (ID Meta)
            await Contact.destroy({
                where: { id: meta_contact_id },
                transaction: t
            });
            console.log(`   ✅ Contato duplicado ${meta_contact_id} removido`);

            stats.merged++;
        });

    } catch (error: any) {
        console.error(`   ❌ ERRO: ${error.message}`);
        stats.errors++;
    }
};

const run = async () => {
    const { dryRun, companyId } = parseArgs();

    console.log("=".repeat(60));
    console.log("🔧 SCRIPT DE MERGE DE CONTATOS DUPLICADOS");
    console.log("=".repeat(60));
    console.log(`Modo: ${dryRun ? "🔍 DRY-RUN (apenas simulação)" : "⚡ EXECUÇÃO REAL"}`);
    if (companyId) {
        console.log(`Empresa: ${companyId}`);
    } else {
        console.log("Empresa: TODAS");
    }
    console.log("=".repeat(60));

    const stats: Stats = {
        found: 0,
        merged: 0,
        ticketsMoved: 0,
        messagesMoved: 0,
        errors: 0
    };

    try {
        // Buscar duplicatas
        console.log("\n🔎 Buscando contatos duplicados...");
        const duplicates = await findDuplicates(companyId);
        stats.found = duplicates.length;

        if (duplicates.length === 0) {
            console.log("\n✅ Nenhum contato duplicado encontrado!");
            process.exit(0);
        }

        console.log(`\n📊 Encontrados ${duplicates.length} contatos duplicados`);

        // Processar cada duplicata
        for (const duplicate of duplicates) {
            await mergeContact(duplicate, stats, dryRun);
        }

        // Resumo final
        console.log("\n" + "=".repeat(60));
        console.log("📊 RESUMO FINAL");
        console.log("=".repeat(60));
        console.log(`Duplicados encontrados: ${stats.found}`);
        console.log(`${dryRun ? "Seriam" : "Foram"} mesclados: ${stats.merged}`);
        console.log(`Tickets ${dryRun ? "seriam" : "foram"} movidos: ${stats.ticketsMoved}`);
        console.log(`Mensagens ${dryRun ? "seriam" : "foram"} movidas: ${stats.messagesMoved}`);
        console.log(`Erros: ${stats.errors}`);
        console.log("=".repeat(60));

        if (dryRun) {
            console.log("\n💡 Para executar de verdade, remova --dry-run");
        }

    } catch (error: any) {
        console.error(`\n❌ ERRO FATAL: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
};

// Executar
run().catch(console.error);
