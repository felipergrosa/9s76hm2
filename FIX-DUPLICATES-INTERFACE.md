# 🔧 Corrigir Interface de Duplicados/Normalização

**Problema**: Interface de "Gestão de Contatos" não está funcionando para reparar duplicados

---

## 🎯 Solução Rápida (3 opções)

### Opção 1: Via SQL (RECOMENDADO - Mais Rápido)

```powershell
# 1. Fazer backup
cd C:\Users\feliperosa\whaticket
docker exec postgres pg_dump -U postgres whaticket > backup_duplicates_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# 2. Executar correção
Get-Content QUICK-FIX-DUPLICATES-NOW.sql | docker exec -i postgres psql -U postgres -d whaticket

# 3. Ver resultado
```

**Tempo**: 2-5 minutos  
**Resultado**: Todos duplicados mesclados automaticamente

---

### Opção 2: Via Interface (Se backend funcionar)

#### Passo 1: Verificar se backend está OK

```powershell
cd C:\Users\feliperosa\whaticket\backend

# Ver se está rodando
# Se não estiver:
npm run dev
```

#### Passo 2: Abrir Interface

```
http://localhost:3000/contacts
```

#### Passo 3: Clicar em "⚙️ Gestão de contatos"

#### Passo 4: Aba "NORMALIZAR"

1. **Ver lista** de contatos pendentes
2. **Selecionar contatos** (ou "Selecionar todos")
3. **Escolher ação**: "Normalizar"
4. **Clicar em "Processar"**

**Resultado**: Contatos normalizados

#### Passo 5: Aba "DUPLICADOS"

1. **Ver lista** de grupos duplicados
2. **Para cada grupo**:
   - **Selecionar** qual contato manter (master)
   - **Marcar** quais duplicados mesclar
   - **Clicar em "Mesclar"**

**Resultado**: Duplicados mesclados

---

### Opção 3: Diagnóstico Completo (Se nada funcionar)

Execute o diagnóstico passo a passo:

```powershell
# Ver arquivo
notepad DIAGNOSTIC-DUPLICATES.md

# Seguir checklist
```

---

## 🧪 Teste Rápido

### Verificar se há duplicados

```sql
-- Conectar ao banco
docker exec -i postgres psql -U postgres -d whaticket

-- Ver duplicados
SELECT 
  "canonicalNumber",
  COUNT(*) as total,
  array_agg(name) as nomes
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != ''
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1
LIMIT 10;

-- Sair
\q
```

**Resultado**:
- **Se aparecer lista**: Há duplicados (use Opção 1 ou 2)
- **Se vazio**: ✅ Sem duplicados!

---

## 🔄 Reiniciar Backend (Se necessário)

```powershell
cd C:\Users\feliperosa\whaticket\backend

# Parar (Ctrl+C)

# Limpar cache de compilação
Remove-Item -Recurse -Force .\dist -ErrorAction SilentlyContinue

# Recompilar
npm run build

# Reiniciar
npm run dev
```

**Aguardar**: Backend iniciar (veja no terminal)

**Testar**: Abrir `http://localhost:3000/contacts`

---

## ✅ Verificação Final

### Via SQL

```sql
-- Total de contatos
SELECT COUNT(*) as total FROM "Contacts" WHERE "isGroup" = false;

-- Normalizados
SELECT COUNT(*) as normalizados 
FROM "Contacts" 
WHERE "isGroup" = false 
  AND "canonicalNumber" IS NOT NULL 
  AND "canonicalNumber" != '';

-- Duplicados restantes (deve ser 0)
SELECT COUNT(*) as duplicados
FROM (
  SELECT "canonicalNumber"
  FROM "Contacts"
  WHERE "isGroup" = false
    AND "canonicalNumber" IS NOT NULL
  GROUP BY "canonicalNumber", "companyId"
  HAVING COUNT(*) > 1
) dup;
```

**Resultado esperado**:
```
total: 1000 (seu número total)
normalizados: 1000 (100%)
duplicados: 0 ✅
```

---

### Via Interface

1. Abrir: `http://localhost:3000/contacts`
2. Clicar: "⚙️ Gestão de contatos"
3. Verificar:
   - **Aba NORMALIZAR**: "0 contatos pendentes" ✅
   - **Aba DUPLICADOS**: "Nenhum resultado encontrado" ✅

---

## 🆘 Se Ainda Não Funcionar

### Problema: Interface não carrega

**Causa**: Frontend em cache antigo

**Solução**:
```powershell
cd C:\Users\feliperosa\whaticket\frontend

# Limpar cache
Remove-Item -Recurse -Force .\node_modules\.cache -ErrorAction SilentlyContinue

# Reiniciar
# Ctrl+C
npm start
```

**Ou**:
- Abrir em aba anônima (Ctrl+Shift+N)
- Limpar cache do navegador (Ctrl+Shift+Del)

---

### Problema: Backend não responde

**Causa**: Erro de compilação

**Solução**:
```powershell
cd C:\Users\feliperosa\whaticket\backend

# Ver logs
# (Ver terminal onde rodou npm run dev)

# Se houver erro, reinstalar dependências
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

---

### Problema: SQL dá erro

**Causa**: Banco em estado inconsistente

**Solução**:
1. **Restaurar backup** (se fez)
2. **Executar migration**:
   ```powershell
   cd C:\Users\feliperosa\whaticket\backend
   npm run migrate
   ```
3. **Tentar novamente**

---

## 📊 Estatísticas (Após Correção)

```sql
-- Ver estatísticas
SELECT 
  'Total contatos' as metrica,
  COUNT(*) as valor
FROM "Contacts"
WHERE "isGroup" = false

UNION ALL

SELECT 
  'Normalizados',
  COUNT(*)
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != ''

UNION ALL

SELECT 
  'Sem normalizar',
  COUNT(*)
FROM "Contacts"
WHERE "isGroup" = false
  AND ("canonicalNumber" IS NULL OR "canonicalNumber" = '')

UNION ALL

SELECT 
  'Grupos duplicados',
  COUNT(*)
FROM (
  SELECT "canonicalNumber"
  FROM "Contacts"
  WHERE "isGroup" = false
    AND "canonicalNumber" IS NOT NULL
  GROUP BY "canonicalNumber", "companyId"
  HAVING COUNT(*) > 1
) dup;
```

**Resultado esperado**:
```
Total contatos     | 1000
Normalizados       | 1000
Sem normalizar     | 0
Grupos duplicados  | 0
```

---

## ✅ Sucesso!

Após executar qualquer das opções acima:

1. ✅ Todos contatos normalizados
2. ✅ Todos duplicados mesclados
3. ✅ Interface funcionando (se usar Opção 2)
4. ✅ Dados íntegros

**Próximo passo**: Use o sistema normalmente! 🎉

---

## 📝 Notas

- **Opção 1 (SQL)** é mais rápida e confiável
- **Opção 2 (Interface)** é melhor para casos pontuais
- **Sempre faça backup** antes de executar SQL
- **Teste em ambiente de DEV** antes de produção

---

**📖 Documentação relacionada**:
- `DIAGNOSTIC-DUPLICATES.md` - Diagnóstico completo
- `QUICK-FIX-DUPLICATES-NOW.sql` - Script SQL de correção
- `FIX-DUPLICATES.sql` - Script SQL antigo
- `PROTECTION-SUMMARY.md` - Proteção contra duplicados futuros
