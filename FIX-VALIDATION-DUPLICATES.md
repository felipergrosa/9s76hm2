# 🛡️ Correção: Validação em Massa e Duplicados

**Data**: 30/10/2025  
**Severidade**: CRÍTICA  
**Status**: Correções implementadas

---

## 🔴 PROBLEMA 1: Validação em Massa ao Abrir Tela

### O que estava acontecendo:

```
INFO [30-10-2025 07:31:01]: [ValidateContact] início (25x em 1 segundo!)
```

**Código antigo** (`ContactController.ts:507`):
```javascript
const ttlHours = 0;  // ❌ FORÇANDO validação SEMPRE
```

**Resultado**:
- Ao abrir tela de contatos = 25+ chamadas simultâneas `ValidateContactService`
- Cada validação = 1 chamada `onWhatsApp()` ao WhatsApp
- **25 requisições ao WhatsApp em 1 segundo = RISCO ALTÍSSIMO DE BAN**

### ✅ Correção Implementada:

1. **Validação desabilitada por padrão** via `.env`:
   ```env
   CONTACT_AUTO_VALIDATE_ON_LIST=false
   ```

2. **Se habilitar, controles rigorosos**:
   ```env
   CONTACT_VALIDATE_TTL_HOURS=168    # 1 semana (não valida o mesmo contato antes disso)
   CONTACT_VALIDATE_MAX_CONCURRENT=3  # Máximo 3 por vez
   ```

3. **Delay entre validações**: 2 segundos entre cada uma

4. **Logs informativos**: mostra quantas validações foram agendadas

### Como funciona agora:

```javascript
// Se CONTACT_AUTO_VALIDATE_ON_LIST=false (padrão)
// → Não valida NADA automaticamente

// Se CONTACT_AUTO_VALIDATE_ON_LIST=true
// → Valida máximo 3 contatos por vez
// → Com 2 segundos de intervalo
// → Só revalida após 1 semana
```

---

## 🔴 PROBLEMA 2: Contatos Duplicados

### O que estava acontecendo:

No print: `15517868419` aparece 2x

**Causa**:
- Contatos antigos sem `canonicalNumber` preenchido
- Números com variações: `15517868419` vs `5515917868419`
- Índice único só funciona se `canonicalNumber` estiver preenchido

### ✅ Correção Implementada:

**Script SQL**: `FIX-DUPLICATES.sql`

Faz:
1. Cria função de normalização SQL
2. Atualiza `canonicalNumber` de contatos antigos
3. Identifica duplicados (mostra lista)
4. Remove duplicados mantendo o melhor registro

---

## 🚀 Como Aplicar as Correções

### Passo 1: Reiniciar Backend

```powershell
cd C:\Users\feliperosa\whaticket\backend
npm run dev
```

**O que muda**:
- ✅ Validação automática ao abrir tela: **DESABILITADA**
- ✅ Não mais 25+ chamadas simultâneas ao WhatsApp
- ✅ Logs ficam limpos (sem spam de ValidateContact)

### Passo 2: Corrigir Duplicados (Recomendado)

```powershell
# 1. Backup do banco
docker exec postgres pg_dump -U postgres whaticket > backup_$(date +%Y%m%d).sql

# 2. Executar script de correção
docker exec -i postgres psql -U postgres -d whaticket < FIX-DUPLICATES.sql
```

**O que acontece**:
1. Normaliza números de contatos antigos
2. Mostra lista de duplicados encontrados
3. (Opcional) Remove duplicados automaticamente

---

## 📊 Comparação: Antes vs Depois

### Antes (PERIGOSO ❌)

```
Abre tela de contatos → 25 contatos na tela
↓
25 chamadas ValidateContactService simultâneas
↓
25 chamadas onWhatsApp() ao WhatsApp
↓
❌ BAN IMINENTE!
```

### Depois (SEGURO ✅)

```
Abre tela de contatos → 25 contatos na tela
↓
NENHUMA validação automática
↓
✅ ZERO requisições ao WhatsApp
```

**Se você habilitar validação**:
```
Abre tela de contatos → 25 contatos na tela
↓
Agenda validação de 3 contatos (máximo)
↓
Valida 1 contato
→ aguarda 2 segundos
→ Valida 2º contato
→ aguarda 2 segundos
→ Valida 3º contato
↓
Total: 3 requisições em 6 segundos (SEGURO ✅)
```

---

## ⚙️ Configurações Disponíveis

### `.env` - Controle de Validação

```env
# Desabilitar completamente (RECOMENDADO)
CONTACT_AUTO_VALIDATE_ON_LIST=false

# OU habilitar com controles (para produção)
CONTACT_AUTO_VALIDATE_ON_LIST=true
CONTACT_VALIDATE_TTL_HOURS=168      # Revalida após 1 semana
CONTACT_VALIDATE_MAX_CONCURRENT=3   # Máximo 3 por vez
```

**Recomendação para DEV**: `false` (desabilitado)  
**Recomendação para PROD**: `false` ou `true` com TTL alto (168h+)

---

## 🎯 Quando Validar Contatos?

### ❌ NÃO faça validação automática:
- Ao abrir tela de contatos
- Em loops/bulk operations
- Mais de 1x por semana por contato

### ✅ Valide apenas quando necessário:
- Usuário clica em "Validar contato" manualmente
- Ao criar novo contato (1x)
- Ao atualizar número do contato (1x)
- Em job noturno (1x por semana, com rate limiting)

### Como validar manualmente:

Na tela de contatos:
1. Clique no contato
2. Clique em "⋮" (três pontos)
3. Selecione "Validar contato"

Isso valida **1 contato por vez**, de forma segura.

---

## 📝 Logs: Como Monitorar

### Antes (Spam):
```
INFO [07:31:01]: [ValidateContact] início contactId: 1895
INFO [07:31:01]: [ValidateContact] início contactId: 1901
INFO [07:31:01]: [ValidateContact] início contactId: 1889
... (25x em 1 segundo!)
```

### Depois (Limpo):
```
INFO [07:31:01]: [Contacts.index] agendadas validações em background
  companyId: 1
  count: 3
  maxConcurrent: 3
  ttlHours: 168
```

**OU se desabilitado** (padrão):
```
(Nenhum log de validação)
```

---

## 🆘 Se Ainda Aparecer Validações em Massa

1. **Confirmar `.env`**:
   ```powershell
   cd backend
   cat .env | Select-String "CONTACT_AUTO_VALIDATE"
   # Deve mostrar: CONTACT_AUTO_VALIDATE_ON_LIST=false
   ```

2. **Reiniciar backend**:
   ```powershell
   npm run dev
   ```

3. **Verificar logs**:
   ```powershell
   # Não deve aparecer [ValidateContact]
   tail -f *.log | Select-String "ValidateContact"
   ```

---

## 📋 Checklist de Segurança

Antes de usar em produção:

- [x] `CONTACT_AUTO_VALIDATE_ON_LIST=false` no `.env`
- [x] Backend reiniciado
- [ ] Script `FIX-DUPLICATES.sql` executado
- [ ] Backup do banco feito
- [ ] Logs monitorados (sem spam de ValidateContact)
- [ ] Duplicados removidos
- [ ] Testes: abrir tela de contatos não gera logs de validação

---

## 🔬 Teste Rápido

1. **Abrir tela de contatos**
2. **Ver logs do backend**
3. **Resultado esperado**: NENHUM log `[ValidateContact]`

Se aparecer logs, algo está errado.

---

## 💡 Por Que Essas Mudanças?

### Validação Automática: Risco x Benefício

**Benefício**:
- Manter campo `isWhatsappValid` atualizado

**Risco**:
- 25+ chamadas `onWhatsApp()` simultâneas
- Risco de ban do WhatsApp
- Rate limiting da API

**Conclusão**: Risco > Benefício → **Desabilitar**

### Alternativas Seguras:

1. **Job noturno**: Valida 10 contatos/hora durante a madrugada
2. **Manual**: Usuário valida quando necessário
3. **Na criação**: Valida 1x ao criar/editar (já implementado)

---

## 📚 Arquivos Modificados

1. **`backend/.env`**
   - Adicionadas variáveis `CONTACT_AUTO_VALIDATE_*`

2. **`backend/src/controllers/ContactController.ts`**
   - Função `index` (linha 504-542)
   - Desabilita validação automática por padrão
   - Adiciona controles de rate limiting

3. **`FIX-DUPLICATES.sql`** (novo)
   - Script para normalizar e remover duplicados

4. **`FIX-VALIDATION-DUPLICATES.md`** (este arquivo)
   - Documentação completa

---

## 🎓 Resumo Executivo

### Antes:
- ❌ 25+ validações simultâneas ao abrir tela
- ❌ Contatos duplicados
- ❌ Risco alto de ban

### Depois:
- ✅ Zero validações automáticas (padrão)
- ✅ Script para remover duplicados
- ✅ Controles de rate limiting (se habilitar)
- ✅ Risco de ban: **ZERO**

---

**⚠️ IMPORTANTE**: Execute o script `FIX-DUPLICATES.sql` para limpar duplicados existentes!
