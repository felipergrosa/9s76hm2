# Padrões Técnicos do Projeto (Whaticket)

Este arquivo serve como instrução permanente para desenvolvedores e IAs.

## 1. Integridade do Build
- O build (`pnpm run build` ou `tsc`) deve passar sem erros antes de qualquer commit.
- Erros de "Property 'fn' does not exist on type 'Sequelize'" devem ser corrigidos importando `fn` diretamente de `sequelize`.

## 2. Normalização de Contatos
- NUNCA assuma que um número de telefone tem no máximo 13 dígitos. Aceite até 20 para compatibilidade com IDs da Meta.
- Use sempre `safeNormalizePhoneNumber` do `utils/phone.ts`.

## 3. Fluxo de Trabalho
- Documente mudanças complexas em `/markdown/walkthrough_XXXX.md`.
- Siga os padrões de tipagem estrita do TypeScript.

## 4. Migrations do Banco de Dados

### Localização OBRIGATÓRIA:
```
backend/src/database/migrations/
```

**NÃO usar:** `backend/database/migrations/` (pasta errada!)

### Nomenclatura:
```
YYYYMMDDHHMMSS-descricao-da-migration.ts
```

Exemplo: `20260314170000-add-tickets-performance-indexes.ts`

### Formato OBRIGATÓRIO (TypeScript):
```typescript
import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nome_indice 
        ON "Tabela" ("coluna1", "coluna2");
      `),
      // outros índices/alterações...
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_nome_indice;`),
      // outros rollbacks...
    ]);
  }
};
```

### Padrões Importantes:
- **Extensão:** `.ts` (TypeScript), NUNCA `.js`
- **Índices:** Usar `CREATE INDEX CONCURRENTLY` para não bloquear tabelas em produção
- **IF NOT EXISTS / IF EXISTS:** Sempre usar para evitar erros em re-execuções
- **Tabelas:** Sempre usar aspas duplas: `"Tickets"`, `"Contacts"`, `"Messages"`

### ⚠️ CRÍTICO - CONCURRENTLY e Transações:
`CREATE INDEX CONCURRENTLY` **NÃO** pode ser executado dentro de uma transação.

**SEMPRE adicionar `{ transaction: null }` em cada query:**

```typescript
// ❌ ERRADO - causa deadlock
await queryInterface.sequelize.query(`
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nome 
  ON "Tabela" ("coluna");
`);

// ✅ CORRETO - funciona
await queryInterface.sequelize.query(`
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nome 
  ON "Tabela" ("coluna");
`, { transaction: null });
```

**Executar sequencialmente (não usar Promise.all no up):**
```typescript
// ✅ CORRETO - sequencial
await queryInterface.sequelize.query(`CREATE INDEX...`, { transaction: null });
await queryInterface.sequelize.query(`CREATE INDEX...`, { transaction: null });

// ❌ ERRADO - pode causar deadlock
await Promise.all([
  queryInterface.sequelize.query(`CREATE INDEX...`, { transaction: null }),
  queryInterface.sequelize.query(`CREATE INDEX...`, { transaction: null })
]);
```

### Executar Migrations:
```bash
cd backend
npm run db:migrate
```

### Rollback:
```bash
npm run db:migrate:undo
```

### Verificar Migrations Executadas:
```sql
SELECT * FROM "SequelizeMeta" ORDER BY name;
```
