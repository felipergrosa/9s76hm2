# Restaurar Fluxo de Processamento de Mensagens do Whaticket

## Contexto

Após ~20 dias de mudanças (commit base funcional: `2b4477a` - 18/01/2026), o sistema apresenta:
- Mensagens **não sendo entregues** no Whaticket
- **Contatos duplicados** (PENDING_ sem número real)
- Mensagens enviadas pelo **celular não sincronizando**
- Histórico de mensagens **inconsistente**

## Diagnóstico: 5 Problemas-Raiz Identificados

### 🔴 Problema 1: `handleMessage` descarta mensagens silenciosamente

**Antes (funcional):**
```typescript
// Fluxo SIMPLES — getContactMessage SEMPRE retorna {id, name}
msgContact = await getContactMessage(msg, wbot);
// verifyContact SEMPRE cria contato (nunca retorna null para números válidos)
const contact = await verifyContact(msgContact, wbot, companyId);
```

**Depois (quebrado):**
```typescript
// Fluxo COMPLEXO — resolveMessageContact pode retornar null
const resolution = await resolveMessageContact(msg, wbot, companyId);
contact = resolution?.contact || null;
if (!contact) {
  logger.error('[handleMessage] ERROR: resolveMessageContact retornou null');
  return; // ⚠️ MENSAGEM DESCARTADA SILENCIOSAMENTE
}
```

**Impacto:** Quando `resolveMessageContact` falha (10+ estratégias LID→PN falham em cascata), a mensagem é **descartada sem entrar no sistema**.

---

### 🔴 Problema 2: Contatos PENDING_ criados para mensagens do celular (fromMe + LID)

O `ContactResolverService.createContact()` cria contatos com `number: "PENDING_<lidJid>"` quando não consegue resolver LID→PN. Isso gera:
- Contatos duplicados ("João" com número real + "Contato a1b2c3" com PENDING_)
- Tickets duplicados (um para cada contato)
- Mensagens divididas entre tickets

**Arquivo:** [createContact.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactResolution/createContact.ts#L160-L245)

---

### 🔴 Problema 3: `resolveLidToPN` com 10+ estratégias que falham em cascata

A função `resolveLidToPN` em [ContactResolverService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactResolution/ContactResolverService.ts#L361-L786) tem **426 linhas** com estratégias A→F que:
- Dependem de APIs externas (onWhatsApp, USync) que podem falhar
- Incluem **busca por nome parcial** (Estratégia F) — match `LIKE '%nome%'` pode retornar contato errado!
- Incluem busca no `wbot.store.contacts` por nome — pode fazer match com contato homônimo

**Risco crítico:** A Estratégia F busca contato por `pushName LIKE '%<parte-do-nome>%'` — se dois contatos têm nome parecido, **retorna o errado**, causando mensagem no ticket errado (bug relatado pelo usuário).

---

### 🟡 Problema 4: Mutex por companyId serializa todas as mensagens

```typescript
const mutex = getTicketMutex(companyId);
let ticket = await mutex.runExclusive(async () => {
  return await FindOrCreateTicketService(...);
});
```

**Impacto:** TODAS as mensagens da empresa passam por um mutex global. Se uma mensagem trava (ex: chamada `onWhatsApp()` lenta), todas as outras mensagens ficam em fila.

O fluxo antigo **não usava mutex** para criação de tickets — era menos seguro mas mais performante.

---

### 🟡 Problema 5: `filterMessages` e `isValidMsg` podem filtrar demais

O novo código tem duas camadas de filtragem antes do `handleMessage`:
1. `filterMessages()` no listener
2. `isValidMsg()` dentro do `handleMessage`

Preciso verificar se essas funções não estão descartando mensagens válidas que antes passavam.

---

## User Review Required

> [!IMPORTANT]
> **Decisão necessária:** A proposta abaixo faz um **rollback parcial** do `handleMessage` para usar o fluxo antigo (`getContactMessage` + `verifyContact`) como caminho primário, mantendo o `ContactResolverService` apenas como fallback. Isso é seguro porque o fluxo antigo era funcional e as funções `getContactMessage` e `verifyContact` **ainda existem no código atual** (não foram deletadas, apenas não são mais chamadas pelo `handleMessage`).

> [!WARNING]
> **Estratégia F (busca por nome parcial)** é um risco de segurança de dados — pode associar mensagem ao contato errado. Vou **remover** essa estratégia completamente. Se discordar, me avise.

## Proposta de Correções

### Correção 1: Restaurar fluxo `getContactMessage` + `verifyContact` no `handleMessage`

#### [MODIFY] [wbotMessageListener.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/WbotServices/wbotMessageListener.ts)

Substituir as linhas ~5009-5080 (novo fluxo `ContactResolverService`) pelo fluxo antigo:

```diff
-    // NOVO FLUXO: ContactResolverService (3 camadas limpas)
-    if (isGroup) {
-      try {
-        groupContact = await resolveGroupContact(msg, wbot, companyId);
-      } catch (error) {
-        logger.error(...);
-        return;
-      }
-    }
-    let contact: Contact | null = null;
-    if (isGroup) {
-      // ... resolução complexa de participante ...
-      const resolution = await resolveMessageContact(msg, wbot, companyId);
-      contact = resolution?.contact || null;
-    } else {
-      const resolution = await resolveMessageContact(msg, wbot, companyId);
-      contact = resolution?.contact || null;
-      if (!contact) {
-        return; // ⚠️ DESCARTA MENSAGEM
-      }
-    }
+    // FLUXO RESTAURADO: getContactMessage + verifyContact (funcional)
+    let msgContact: IMe;
+    msgContact = await getContactMessage(msg, wbot);
+    
+    if (isGroup) {
+      // resolução do grupo via metadados
+      const groupJid = msg.key.remoteJid;
+      let groupSubject = groupJid;
+      try {
+        const grupoMeta = await wbot.groupMetadata(groupJid);
+        groupSubject = grupoMeta?.subject || groupJid;
+      } catch { }
+      const msgGroupContact = { id: groupJid, name: groupSubject };
+      groupContact = await verifyContact(msgGroupContact, wbot, companyId, userId);
+    }
+    
+    let contact = await verifyContact(msgContact, wbot, companyId, userId);
+    
+    if (!contact && !isGroup) {
+      logger.error('[handleMessage] verifyContact retornou null', {
+        remoteJid: msg.key.remoteJid, pushName: msg.pushName
+      });
+      return;
+    }
+    if (!contact && isGroup) {
+      contact = groupContact;
+    }
```

---

### Correção 2: Remover Estratégia F (busca por nome parcial) do `ContactResolverService`

#### [MODIFY] [ContactResolverService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactResolution/ContactResolverService.ts)

Remover linhas 700-783 (Estratégia F) que buscam contato por `pushName LIKE '%...%'` — é o principal causador de mensagens no ticket errado.

---

### Correção 3: Restaurar `getContactMessage` chamada ANTES do filtro de fromMe

#### [MODIFY] [wbotMessageListener.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/WbotServices/wbotMessageListener.ts)

No fluxo atual, `getContactMessage` é chamado **dentro** de `resolveMessageContact`. No fluxo antigo, era chamado **antes** do filtro de `msg.key.fromMe`, garantindo que o contato é sempre extraído da mensagem independente de quem enviou.

---

### Correção 4: Manter mutex mas com timeout

#### [MODIFY] [wbotMessageListener.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/WbotServices/wbotMessageListener.ts)

Adicionar timeout de 5s ao mutex para evitar bloqueio indefinido:

```diff
-let ticket = await mutex.runExclusive(async () => {
+let ticket = await mutex.runExclusive(async () => {
   return await FindOrCreateTicketService(...);
-});
+}).catch(err => {
+  if (err.message?.includes('timeout')) {
+    logger.error('[handleMessage] Mutex timeout - processando sem exclusão', { contactId: contact.id });
+    return FindOrCreateTicketService(...);
+  }
+  throw err;
+});
```

---

## Verificação

### Testes Automatizados
O projeto **não possui testes unitários** para `wbotMessageListener.ts` ou `ContactResolverService`. Não vou criar testes novos pois a prioridade é restaurar a funcionalidade.

### Verificação de Build
```bash
cd c:\Users\feliperosa\whaticket\backend && npx tsc --noEmit
```

### Verificação Manual (feita pelo usuário)
1. **Enviar mensagem pelo celular** (app WhatsApp) para um contato que tem ticket aberto no Whaticket → mensagem deve aparecer no ticket correto
2. **Receber mensagem de contato novo** → contato deve ser criado com número real (não PENDING_)
3. **Receber mensagem de contato existente** → mensagem deve ir para o ticket existente do contato
4. **Verificar logs do PM2** → `pm2 logs backend --lines 100` → não deve ter erros `resolveMessageContact retornou null`
5. **Verificar contatos PENDING_** no banco:
   ```sql
   SELECT id, name, number, "lidJid", "remoteJid" FROM "Contacts" WHERE number LIKE 'PENDING_%' ORDER BY "createdAt" DESC LIMIT 20;
   ```
