import { Op, QueryTypes, Transaction } from "sequelize";
import sequelize from "../database";
import Contact from "../models/Contact";

interface DuplicateGroup {
  companyId: number;
  canonicalNumber: string;
  count: number;
}

interface MergeResult {
  masterId: number;
  mergedIds: number[];
  updates: Record<string, number>;
}

const referencingTables: Array<{ table: string; column: string }> = [
  { table: "Tickets", column: "contactId" },
  { table: "Messages", column: "contactId" },
  { table: "ContactTags", column: "contactId" },
  { table: "ContactCustomFields", column: "contactId" },
  { table: "ContactWallets", column: "contactId" },
  { table: "ContactWhatsappLabels", column: "contactId" },
  { table: "CampaignShipping", column: "contactId" },
  { table: "Schedules", column: "contactId" },
  { table: "TicketNotes", column: "contactId" },
  { table: "LogTickets", column: "contactId" }
];

const usage = () => {
  console.log(`\n🧹  Script de deduplicação de contatos\n`);
  console.log(`Uso: npx ts-node src/scripts/dedupeContacts.ts [--company=<id>] [--apply] [--limit=<n>]`);
  console.log(`  --apply      Executa as alterações (por padrão é Dry Run).`);
  console.log(`  --company    Filtra por companyId específico.`);
  console.log(`  --limit      Limita o número de grupos processados.`);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options: { apply: boolean; companyId?: number; limit?: number } = { apply: false };

  args.forEach(arg => {
    if (arg === "--help") {
      usage();
      process.exit(0);
    }
    if (arg === "--apply") {
      options.apply = true;
      return;
    }
    if (arg.startsWith("--company=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isFinite(value)) {
        throw new Error(`Valor inválido para --company: ${arg}`);
      }
      options.companyId = value;
      return;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isFinite(value)) {
        throw new Error(`Valor inválido para --limit: ${arg}`);
      }
      options.limit = value;
      return;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  });

  return options;
};

const fetchDuplicateGroups = async (companyId?: number, limit?: number): Promise<DuplicateGroup[]> => {
  const replacements: Record<string, unknown> = {};
  let whereClause = '"canonicalNumber" IS NOT NULL';

  if (companyId) {
    whereClause += ' AND "companyId" = :companyId';
    replacements.companyId = companyId;
  }

  const limitSql = limit ? ` LIMIT ${limit}` : "";

  const sql = `
    SELECT "companyId", "canonicalNumber", COUNT(*) AS count
    FROM "Contacts"
    WHERE ${whereClause}
    GROUP BY "companyId", "canonicalNumber"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    ${limitSql}
  `;

  const rows = await sequelize.query(sql, {
    type: QueryTypes.SELECT,
    replacements
  });

  return rows.map(row => ({
    companyId: Number((row as any).companyId),
    canonicalNumber: String((row as any).canonicalNumber),
    count: Number((row as any).count)
  }));
};

const mergeGroup = async (
  group: DuplicateGroup,
  applyChanges: boolean
): Promise<MergeResult | null> => {
  const contacts = await Contact.findAll({
    where: {
      companyId: group.companyId,
      canonicalNumber: group.canonicalNumber
    },
    order: [["updatedAt", "DESC"]]
  });

  if (contacts.length <= 1) {
    return null;
  }

  const [master, ...duplicates] = contacts;

  const result: MergeResult = {
    masterId: master.id,
    mergedIds: duplicates.map(c => c.id),
    updates: {}
  };

  if (!applyChanges) {
    return result;
  }

  return sequelize.transaction(async (transaction: Transaction) => {
    for (const dup of duplicates) {
      for (const ref of referencingTables) {
        const [affected] = await sequelize.query(
          `UPDATE "${ref.table}" SET "${ref.column}" = :masterId WHERE "${ref.column}" = :duplicateId`,
          {
            replacements: { masterId: master.id, duplicateId: dup.id },
            transaction,
            type: QueryTypes.UPDATE
          }
        );

        result.updates[ref.table] = (result.updates[ref.table] || 0) + Number(affected || 0);
      }

      await sequelize.query(
        'DELETE FROM "ContactCustomFields" WHERE "contactId" = :duplicateId',
        { transaction, replacements: { duplicateId: dup.id }, type: QueryTypes.DELETE }
      );

      await dup.destroy({ transaction, force: true });
    }

    await master.update({ number: group.canonicalNumber }, { transaction });

    return result;
  });
};

const run = async () => {
  const { apply, companyId, limit } = parseArgs();

  console.log(`\n🔍  Iniciando deduplicação ${apply ? "(APLICANDO ALTERAÇÕES)" : "(DRY RUN)"}`);
  if (companyId) console.log(` • companyId: ${companyId}`);
  if (limit) console.log(` • limite de grupos: ${limit}`);

  await sequelize.authenticate();

  const groups = await fetchDuplicateGroups(companyId, limit);

  if (!groups.length) {
    console.log("✅ Nenhum grupo duplicado encontrado.");
    process.exit(0);
  }

  console.log(`Encontrados ${groups.length} grupos duplicados.`);

  const summary: MergeResult[] = [];

  for (const group of groups) {
    console.log(`\n➡️  Empresa ${group.companyId} • Número ${group.canonicalNumber} • Registros: ${group.count}`);
    const res = await mergeGroup(group, apply);
    if (!res) continue;

    if (apply) {
      console.log(`   ✔️  Mestre ${res.masterId} ← mesclados ${res.mergedIds.join(", ")}`);
      if (Object.keys(res.updates).length) {
        console.log("   Atualizações por tabela:");
        Object.entries(res.updates).forEach(([table, count]) => {
          if (count > 0) {
            console.log(`     • ${table}: ${count}`);
          }
        });
      }
    } else {
      console.log(`   (dry-run) Mestre sugerido ${res.masterId} | Duplicados: ${res.mergedIds.join(", ")}`);
    }

    summary.push(res);
  }

  console.log("\n📋  Resumo");
  console.log(` • Grupos analisados: ${summary.length}`);
  if (apply) {
    const totalMerged = summary.reduce((acc, item) => acc + item.mergedIds.length, 0);
    console.log(` • Contatos removidos: ${totalMerged}`);
  } else {
    console.log(" • Nenhuma alteração aplicada (modo dry-run).");
  }

  await sequelize.close();

  console.log("\n✅  Processo concluído.");
};

run().catch(err => {
  console.error("❌ Erro na deduplicação:", err);
  sequelize.close();
  process.exit(1);
});
