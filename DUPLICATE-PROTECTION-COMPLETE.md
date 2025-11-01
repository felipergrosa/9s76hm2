# 🛡️ Proteção Completa Contra Duplicados

**Data**: 30/10/2025  
**Status**: Implementação Completa em Múltiplas Camadas

---

## 🎯 Objetivo

**PREVENIR duplicados em TODOS os pontos de entrada**, não apenas detectar depois.

---

## 🔒 Camadas de Proteção

### 1️⃣ **Camada de Banco (CRÍTICA)**

**Trigger automático** que normaliza ANTES de salvar:

```sql
CREATE TRIGGER normalize_contact_before_save
  BEFORE INSERT OR UPDATE ON "Contacts"
  FOR EACH ROW
  EXECUTE FUNCTION normalize_contact_number();
```

**O que faz**:
- Remove caracteres não-numéricos
- Remove zeros à esquerda
- Adiciona DDI 55 se necessário (Brasil)
- Adiciona 9 em celulares BR sem 9
- Atualiza `number` e `canonicalNumber` automaticamente

**Resultado**: **IMPOSSÍVEL** salvar contato sem normalização!

---

### 2️⃣ **Camada de Serviço**

Todos os serviços de criação já normalizam e verificam duplicados:

#### ✅ CreateContactService
```typescript
const { canonical } = safeNormalizePhoneNumber(number);
const existingContact = await Contact.findOne({
  where: { companyId, canonicalNumber: canonical }
});
```
**Usado em**: Inclusão manual via API

#### ✅ CreateOrUpdateContactService
```typescript
const { canonical } = !isGroup ? safeNormalizePhoneNumber(rawNumber) : { canonical: null };
contact = await Contact.findOne({
  where: isGroup ? { number: rawNumberDigits, companyId } : { companyId, canonicalNumber: number }
});
```
**Usado em**: 
- Captura de nova conversa (wbotMessageListener)
- Atualização de contatos existentes

#### ✅ CreateOrUpdateContactServiceForImport
```typescript
const { canonical } = !isGroup ? safeNormalizePhoneNumber(rawString) : { canonical: null };
contact = await Contact.findOne({
  where: isGroup ? { number: rawString.trim(), companyId } : { companyId, canonicalNumber: number }
});
```
**Usado em**:
- Importação de arquivos CSV/Excel
- Importação em massa

#### ✅ ImportDeviceContactsAutoService
Usa `CreateOrUpdateContactServiceForImport` internamente

**Usado em**: Importação do aparelho WhatsApp

---

### 3️⃣ **Camada de Índice (Banco)**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_canonical_number_company_id_unique"
ON "Contacts" ("canonicalNumber", "companyId")
WHERE "isGroup" = false AND "canonicalNumber" IS NOT NULL;
```

**Resultado**: Banco **REJEITA** INSERT/UPDATE de duplicados!

---

## 📍 Pontos de Entrada (TODOS PROTEGIDOS)

### ✅ 1. Inclusão Manual (Interface)
- **Controller**: `ContactController.store`
- **Service**: `CreateContactService`
- **Proteção**: ✅ Normaliza + verifica duplicado

### ✅ 2. Nova Conversa (WhatsApp)
- **Listener**: `wbotMessageListener`
- **Service**: `CreateOrUpdateContactService`
- **Proteção**: ✅ Normaliza + verifica duplicado

### ✅ 3. Importação CSV/Excel
- **Service**: `ImportContactsService`
- **Service Interno**: `CreateOrUpdateContactServiceForImport`
- **Proteção**: ✅ Normaliza + verifica duplicado

### ✅ 4. Importação do Aparelho
- **Service**: `ImportDeviceContactsAutoService`
- **Service Interno**: `CreateOrUpdateContactServiceForImport`
- **Proteção**: ✅ Normaliza + verifica duplicado

### ✅ 5. API Externa
- **Controller**: `ContactController.store`
- **Service**: `CreateContactService`
- **Proteção**: ✅ Normaliza + verifica duplicado

### ✅ 6. Campanhas (criação de contato no envio)
- **Queue**: `queues.ts -> handleDispatchCampaign`
- **Service**: `Contact.findOrCreate` com `canonicalNumber`
- **Proteção**: ✅ Normaliza + verifica duplicado

---

## 🔧 Correções Implementadas

### 1. Serviço de Detecção de Duplicados

**Antes** (ERRADO):
```sql
-- Usava REGEXP_REPLACE no SELECT, não funcionava
COALESCE(
  NULLIF(REGEXP_REPLACE(COALESCE("canonicalNumber", ''), '[^0-9]', '', 'g'), ''),
  ...
)
```

**Depois** (CORRETO):
```sql
-- Usa canonicalNumber direto, pois já está normalizado
SELECT "canonicalNumber" AS normalized
FROM "Contacts"
WHERE "canonicalNumber" IS NOT NULL
```

### 2. Serviço de Pendentes de Normalização

**Antes** (ERRADO):
```typescript
// Falhava com contatos sem canonicalNumber
sequelizeWhere(fn("length", col("canonicalNumber")), { [Op.lt]: 8 })
```

**Depois** (CORRETO):
```typescript
// Usa COALESCE para evitar null
sequelizeWhere(fn("length", fn("COALESCE", col("canonicalNumber"), "")), { [Op.lt]: 8 })
```

---

## 🚀 Como Aplicar

### Passo 1: Executar Migration (OBRIGATÓRIO)

```powershell
cd backend
npm run migrate
```

**O que acontece**:
1. Cria função `normalize_contact_number()`
2. Cria trigger `normalize_contact_before_save`
3. Normaliza contatos existentes

### Passo 2: Reiniciar Backend

```powershell
npm run dev
```

### Passo 3: Testar Proteção

```powershell
# 1. Tentar criar contato duplicado
# Via interface: adicionar contato com número já existente

# 2. Ver erro esperado:
# "Contato com este número já existe"

# 3. Verificar logs:
# Não deve criar duplicado
```

---

## 🧪 Testes de Validação

### Teste 1: Normalização Automática

```sql
-- Inserir contato sem normalização
INSERT INTO "Contacts" (name, number, "companyId", "isGroup", "createdAt", "updatedAt")
VALUES ('Teste', '15 9 1786-8419', 1, false, NOW(), NOW());

-- Verificar que foi normalizado automaticamente
SELECT number, "canonicalNumber" FROM "Contacts" WHERE name = 'Teste';
-- Resultado esperado: number = '5515917868419', canonicalNumber = '5515917868419'
```

### Teste 2: Rejeição de Duplicados

```sql
-- Inserir contato
INSERT INTO "Contacts" (name, number, "canonicalNumber", "companyId", "isGroup", "createdAt", "updatedAt")
VALUES ('Contato1', '5515917868419', '5515917868419', 1, false, NOW(), NOW());

-- Tentar inserir duplicado (mesmo número em formato diferente)
INSERT INTO "Contacts" (name, number, "companyId", "isGroup", "createdAt", "updatedAt")
VALUES ('Contato2', '(15) 9 1786-8419', 1, false, NOW(), NOW());

-- Resultado esperado: ERRO - duplicate key violates unique constraint
```

### Teste 3: Variações do Mesmo Número

Todos os formatos abaixo são **NORMALIZADOS PARA O MESMO**:

```
15917868419           → 5515917868419
5515917868419         → 5515917868419
(15) 9 1786-8419      → 5515917868419
+55 15 91786-8419     → 5515917868419
055 15 91786-8419     → 5515917868419
```

**Resultado**: Só o primeiro é salvo, demais são rejeitados como duplicado.

---

## 📊 Monitoramento

### Ver Contatos Duplicados

```sql
SELECT 
  "canonicalNumber",
  COUNT(*) as total,
  array_agg(name) as nomes
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1;
```

**Resultado esperado após correção**: `0 rows`

### Ver Contatos Sem Normalização

```sql
SELECT 
  id, name, number, "canonicalNumber"
FROM "Contacts"
WHERE "isGroup" = false
  AND (
    "canonicalNumber" IS NULL 
    OR "canonicalNumber" = ''
    OR number != "canonicalNumber"
  );
```

**Resultado esperado após correção**: `0 rows` (exceto grupos)

---

## 🎯 Interface: Gestão de Contatos

### Aba "NORMALIZAR"

**Antes**: Mostrava "0 contatos pendentes" (bug)

**Depois**: 
- Detecta contatos sem `canonicalNumber`
- Detecta contatos onde `number != canonicalNumber`
- Permite normalizar em massa

### Aba "DUPLICADOS"

**Antes**: Mostrava "0 duplicados" (bug)

**Depois**:
- Detecta contatos com mesmo `canonicalNumber`
- Lista agrupado por número
- Permite mesclar/excluir duplicados

---

## ⚠️ Casos Especiais

### 1. Grupos

Grupos **NÃO** são normalizados:
```typescript
if (!isGroup) {
  // normaliza
}
```

### 2. Números Internacionais

Aceitos conforme E.164 (8-15 dígitos):
```sql
WHERE LENGTH(canonical) BETWEEN 8 AND 15
```

### 3. Números Inválidos

Trigger rejeita com erro:
```sql
RAISE EXCEPTION 'Número inválido: %', NEW.number;
```

---

## 📋 Checklist de Validação

Após aplicar:

- [ ] Migration executada com sucesso
- [ ] Backend reiniciado
- [ ] Aba "DUPLICADOS" mostra duplicados existentes (se houver)
- [ ] Aba "NORMALIZAR" mostra pendentes (se houver)
- [ ] Tentar criar duplicado = ERRO
- [ ] Logs não mostram erros de duplicados

---

## 🔄 Workflow Completo

```
Usuário cria contato
  ↓
Service normaliza número (ex: "15 91786-8419" → "5515917868419")
  ↓
Service busca por canonicalNumber = "5515917868419"
  ↓
Se existe → ATUALIZA (não cria duplicado)
  ↓
Se não existe → Continua para INSERT
  ↓
Trigger do banco normaliza ANTES de salvar
  ↓
Índice único verifica se já existe
  ↓
Se duplicado → ERRO (rejeitado pelo banco)
  ↓
Se único → SALVA
  ↓
✅ SUCESSO: Contato salvo normalizado e sem duplicados
```

---

## 🛠️ Manutenção

### Limpar Duplicados Existentes

```powershell
# Executar script de correção
docker exec -i postgres psql -U postgres -d whaticket < FIX-DUPLICATES.sql
```

### Ver Estatísticas

```sql
-- Total de contatos
SELECT COUNT(*) FROM "Contacts" WHERE "isGroup" = false;

-- Contatos normalizados
SELECT COUNT(*) FROM "Contacts" 
WHERE "isGroup" = false 
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != '';

-- Taxa de normalização
SELECT 
  ROUND(100.0 * COUNT(*) FILTER (WHERE "canonicalNumber" IS NOT NULL) / COUNT(*), 2) as percentual_normalizado
FROM "Contacts"
WHERE "isGroup" = false;
```

---

## 🎓 Resumo Executivo

### Antes:
- ❌ Duplicados criados livremente
- ❌ Normalização inconsistente
- ❌ Interface não detectava problemas
- ❌ 6+ pontos de entrada sem proteção

### Depois:
- ✅ Trigger automatico normaliza SEMPRE
- ✅ Índice único rejeita duplicados
- ✅ Services verificam antes de criar
- ✅ Interface detecta e permite corrigir
- ✅ TODOS os pontos de entrada protegidos

---

## 📚 Arquivos Criados/Modificados

### Criados:
1. `backend/src/database/migrations/20251030000000-enforce-canonical-number-on-save.ts`
2. `DUPLICATE-PROTECTION-COMPLETE.md` (este arquivo)
3. `FIX-DUPLICATES.sql`

### Modificados:
1. `backend/src/services/ContactServices/ListDuplicateContactsService.ts`
2. `backend/src/services/ContactServices/ListContactsPendingNormalizationService.ts`

---

**🎉 Agora está IMPOSSÍVEL criar duplicados!**

Proteção em 3 camadas:
1. **Service** (verifica duplicado)
2. **Trigger** (normaliza automaticamente)
3. **Índice Único** (rejeita no banco)
