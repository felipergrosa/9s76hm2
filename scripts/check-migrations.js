// Checagem estática: garante que migrations referenciam nomes de tabela
// que existem — evita "No description found for table" em runtime.
// Fontes de verdade: tableName dos models + createTable das próprias migrations.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const modelsDir = path.join(root, "backend", "src", "models");
const migrationsDir = path.join(root, "backend", "src", "database", "migrations");

const knownTables = new Set();
const migFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".ts"));

// Extrai "const x = 'Tabela'" de um source (nomes de tabela via variável)
const extractTableVars = src => {
  const vars = {};
  for (const m of src.matchAll(
    /(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*["'`]([\w]+)["'`]/g
  )) {
    vars[m[1]] = m[2];
  }
  return vars;
};

// 1. tableName explícito nos models (@Table({ tableName: "X" }))
fs.readdirSync(modelsDir)
  .filter(f => f.endsWith(".ts"))
  .forEach(f => {
    const src = fs.readFileSync(path.join(modelsDir, f), "utf8");
    const m = src.match(/tableName\s*:\s*["'`]([\w]+)["'`]/);
    if (m) knownTables.add(m[1]);
  });

// 2. Tabelas criadas por migrations — createTable("X") ou createTable(var, ...)
migFiles.forEach(f => {
  const src = fs.readFileSync(path.join(migrationsDir, f), "utf8");
  const vars = extractTableVars(src);
  for (const m of src.matchAll(/createTable\(\s*["'`]([\w]+)["'`]/g)) {
    knownTables.add(m[1]);
  }
  for (const m of src.matchAll(/createTable\(\s*([a-zA-Z_$][\w$]*)/g)) {
    if (vars[m[1]]) knownTables.add(vars[m[1]]);
  }
});

// 3. Defaults Sequelize usados no projeto (models com @Table sem tableName)
["Messages", "TicketTraking", "TicketTrackings"].forEach(t =>
  knownTables.add(t)
);

// Verifica referências a tabelas em cada migration
const TABLE_REF = /(?:describeTable|addColumn|removeColumn|renameColumn|addIndex|removeIndex|addConstraint|removeConstraint|dropTable|changeColumn)\(\s*["'`]([\w]+)["'`]/g;
const TABLE_VAR_REF = /(?:describeTable|addColumn|removeColumn|renameColumn|addIndex|removeIndex|addConstraint|removeConstraint|dropTable|changeColumn)\(\s*([a-zA-Z_$][\w$]*)/g;

let errors = 0;
migFiles.forEach(f => {
  const src = fs.readFileSync(path.join(migrationsDir, f), "utf8");
  const tableVars = extractTableVars(src);

  const check = (table, ctx) => {
    if (!knownTables.has(table)) {
      console.log(`  [ERRO] ${f}: tabela "${table}" (${ctx}) não encontrada nos models/migrations`);
      errors++;
    }
  };

  for (const m of src.matchAll(TABLE_REF)) check(m[1], "literal");
  for (const m of src.matchAll(TABLE_VAR_REF)) {
    if (tableVars[m[1]]) check(tableVars[m[1]], `const ${m[1]}`);
  }

  // Nomes de tabela dentro de SQL raw: ON "X", FROM "X", JOIN "X",
  // INTO "X", UPDATE "X", ALTER TABLE "X", DROP TABLE ... "X"
  for (const m of src.matchAll(
    /\b(?:ON|FROM|JOIN|INTO|UPDATE|TABLE)\s+"([\w]+)"/g
  )) {
    // Ignora nomes de índice/constraint (minúsculos com prefixo idx_/fk_/etc.)
    if (/^(idx|fk|pk|uniq)_/i.test(m[1])) continue;
    check(m[1], "SQL raw");
  }
});

if (errors > 0) {
  console.log(`\n${errors} referência(s) de tabela inválida(s) em migrations.`);
  process.exit(1);
}
console.log(`OK — ${migFiles.length} migrations, ${knownTables.size} tabelas conhecidas, nenhuma referência inválida.`);
