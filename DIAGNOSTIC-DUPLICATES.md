# 🔍 Diagnóstico: Interface de Duplicados/Normalização

**Data**: 30/10/2025  
**Problema**: Interface de "Gestão de Contatos" não permite mesclar/normalizar

---

## ✅ Checklist de Diagnóstico

### 1. Backend está rodando?

```powershell
# Ver se backend está rodando
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Ver logs do backend
cd C:\Users\feliperosa\whaticket\backend
# (Ver terminal onde rodou npm run dev)
```

**✅ Esperado**: Backend rodando sem erros

---

### 2. APIs estão respondendo?

```powershell
# Testar API de duplicados (substitua TOKEN pelo seu token)
$headers = @{ "Authorization" = "Bearer SEU_TOKEN_AQUI" }
Invoke-RestMethod -Uri "http://localhost:8080/contacts/duplicates?page=1&limit=10" -Headers $headers

# Testar API de normalização
Invoke-RestMethod -Uri "http://localhost:8080/contacts/pending-normalization?page=1&limit=10" -Headers $headers
```

**✅ Esperado**: Retorna JSON com `{ groups: [...], total: X }`

**❌ Erro comum**: 
```json
{ "error": "..." }
```

---

### 3. Contatos têm `canonicalNumber`?

```sql
-- Ver contatos SEM canonicalNumber
SELECT 
  id, name, number, "canonicalNumber"
FROM "Contacts"
WHERE "isGroup" = false
  AND ("canonicalNumber" IS NULL OR "canonicalNumber" = '')
LIMIT 10;
```

**✅ Esperado**: Alguns contatos sem normalizar (serão mostrados na aba "NORMALIZAR")

---

### 4. Há duplicados no banco?

```sql
-- Ver duplicados
SELECT 
  "canonicalNumber",
  COUNT(*) as total,
  array_agg(id) as ids,
  array_agg(name) as nomes
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != ''
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1
LIMIT 10;
```

**✅ Esperado**: Lista de números duplicados (serão mostrados na aba "DUPLICADOS")

**❌ Problema**: Se não aparecer nada, pode ser que:
- Todos já estão normalizados ✅
- `canonicalNumber` está vazio/null ❌

---

### 5. Frontend está atualizado?

```powershell
cd C:\Users\feliperosa\whaticket\frontend

# Verificar se há mudanças não aplicadas
git status

# Se tiver mudanças, recompilar
npm run build

# OU reiniciar dev server
# Ctrl+C
npm start
```

---

## 🛠️ Correção Rápida (Se nada funcionar)

### Problema: `canonicalNumber` vazio

Se muitos contatos estão sem `canonicalNumber`, execute:

```sql
-- BACKUP PRIMEIRO!
BEGIN;

-- Normalizar contatos brasileiros
UPDATE "Contacts" c
SET "canonicalNumber" = (
  CASE
    -- Remove não-dígitos
    WHEN regexp_replace(c.number, '\D', '', 'g') IS NULL OR regexp_replace(c.number, '\D', '', 'g') = '' THEN NULL
    
    -- Se tem 10-11 dígitos e não começa com DDI, adiciona 55
    WHEN length(regexp_replace(c.number, '\D', '', 'g')) BETWEEN 10 AND 11 
      AND NOT (regexp_replace(c.number, '\D', '', 'g') ~ '^(1|54|55)') THEN
      '55' || regexp_replace(c.number, '\D', '', 'g')
    
    -- Se é BR com 10 dígitos (sem o 9), adiciona
    WHEN substring(regexp_replace(c.number, '\D', '', 'g') FROM 1 FOR 2) = '55'
      AND length(substring(regexp_replace(c.number, '\D', '', 'g') FROM 5)) = 8
      AND substring(regexp_replace(c.number, '\D', '', 'g') FROM 5 FOR 1) ~ '[6-9]' THEN
      '55' || substring(regexp_replace(c.number, '\D', '', 'g') FROM 3 FOR 2) || '9' || substring(regexp_replace(c.number, '\D', '', 'g') FROM 5)
    
    -- Caso padrão: apenas limpa
    ELSE regexp_replace(c.number, '\D', '', 'g')
  END
)
WHERE c."isGroup" = false
  AND (c."canonicalNumber" IS NULL OR c."canonicalNumber" = '' OR c."canonicalNumber" != c.number);

-- Ver quantos foram atualizados
SELECT COUNT(*) FROM "Contacts" WHERE "isGroup" = false AND "canonicalNumber" IS NOT NULL;

-- Se estiver OK:
COMMIT;

-- Se houver erro:
-- ROLLBACK;
```

---

### Problema: Interface não carrega dados

**Causa**: Frontend está em cache antigo

**Solução**:

```powershell
# 1. Limpar cache do navegador
# Ctrl+Shift+Del > Limpar cache

# 2. Ou abrir em aba anônima
# Ctrl+Shift+N (Chrome)

# 3. Ou forçar reload
# Ctrl+Shift+R
```

---

## 🧪 Teste Manual

### 1. Abrir Interface

```
http://localhost:3000/contacts
```

### 2. Clicar em "⚙️ Gestão de contatos"

### 3. Verificar Abas

#### Aba "NORMALIZAR"

**Deve mostrar**:
- Contatos sem `canonicalNumber`
- Contatos com `canonicalNumber` inválido
- Botão "Normalizar"

**Se não aparecer nada**:
- ✅ Todos contatos já normalizados! 🎉
- ❌ Ou backend não está respondendo

#### Aba "DUPLICADOS"

**Deve mostrar**:
- Grupos de contatos com mesmo `canonicalNumber`
- Botão "Mesclar" ou "Excluir"

**Se não aparecer nada**:
- ✅ Sem duplicados! 🎉  
- ❌ Ou `canonicalNumber` está vazio/null

---

## 🔧 Verificar Services no Backend

### ProcessDuplicateContactsService

```powershell
# Ver se arquivo existe e está compilado
Test-Path C:\Users\feliperosa\whaticket\backend\src\services\ContactServices\ProcessDuplicateContactsService.ts

# Ver conteúdo
Get-Content C:\Users\feliperosa\whaticket\backend\src\services\ContactServices\ProcessDuplicateContactsService.ts | Select -First 10
```

### ProcessContactsNormalizationService

```powershell
Test-Path C:\Users\feliperosa\whaticket\backend\src\services\ContactServices\ProcessContactsNormalizationService.ts
```

**✅ Ambos devem existir**

---

## 📊 Ver Estatísticas

```sql
-- Total de contatos
SELECT COUNT(*) as total FROM "Contacts" WHERE "isGroup" = false;

-- Normalizados
SELECT COUNT(*) as normalizados 
FROM "Contacts" 
WHERE "isGroup" = false 
  AND "canonicalNumber" IS NOT NULL 
  AND "canonicalNumber" != '';

-- Taxa de normalização
SELECT 
  ROUND(100.0 * COUNT(*) FILTER (WHERE "canonicalNumber" IS NOT NULL) / COUNT(*), 2) as percentual
FROM "Contacts"
WHERE "isGroup" = false;

-- Duplicados
SELECT COUNT(DISTINCT "canonicalNumber") as unicos,
       COUNT(*) as total,
       COUNT(*) - COUNT(DISTINCT "canonicalNumber") as duplicados
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL;
```

---

## 🆘 Se Ainda Não Funcionar

### Recompilar Backend

```powershell
cd C:\Users\feliperosa\whaticket\backend

# Parar backend (Ctrl+C)

# Recompilar
npm run build

# Reiniciar
npm run dev
```

### Reiniciar Frontend

```powershell
cd C:\Users\feliperosa\whaticket\frontend

# Parar (Ctrl+C)

# Limpar cache
npm run clean

# Reiniciar
npm start
```

### Verificar Logs

```powershell
# Ver logs do backend
cd C:\Users\feliperosa\whaticket\backend
# Ver terminal

# Procurar por erros:
# - "Error"
# - "Failed"
# - "Cannot"
# - "undefined"
```

---

## ✅ Checklist Final

- [ ] Backend rodando sem erros
- [ ] APIs `/contacts/duplicates` e `/contacts/pending-normalization` respondendo
- [ ] Contatos têm `canonicalNumber` preenchido
- [ ] Query de duplicados retorna resultados
- [ ] Interface "Gestão de Contatos" abre
- [ ] Aba "NORMALIZAR" mostra contatos (se houver)
- [ ] Aba "DUPLICADOS" mostra grupos (se houver)
- [ ] Botões "Normalizar" e "Mesclar" funcionam

---

**📝 Próximo passo**: Se todos os checks passarem, teste normalizar/mesclar um contato.
