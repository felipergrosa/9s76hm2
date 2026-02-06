# ARQUITETURA UNIFICADA DE RESOLUÇÃO DE CONTATOS — WHATICKET
**Modo:** N2 (Critical) — Integridade de dados  
**Data:** 2025-02-06  
**Versão:** 2.0 (Revisão profunda de engenharia)

---

## 1. INVENTÁRIO DO ESTADO ATUAL

### 1.1 Modelo de Dados — Contact

```
Tabela: Contacts
┌──────────────────┬──────────────────────────────────────────────┐
│ number           │ UNIQUE + NOT NULL. Usado como PK funcional.  │
│                  │ Pode conter: PN ("5515999..."), LID digits   │
│                  │ ("247540473..."), ou grupo ("12012...@g.us"). │
├──────────────────┼──────────────────────────────────────────────┤
│ canonicalNumber  │ Normalizado via safeNormalizePhoneNumber().   │
│                  │ NULL para grupos e LIDs não-resolvidos.       │
│                  │ UNIQUE parcial (WHERE NOT NULL) + companyId.  │
├──────────────────┼──────────────────────────────────────────────┤
│ remoteJid        │ O JID completo (ex: "5515...@s.whatsapp.net" │
│                  │ ou "24754...@lid"). UNIQUE + companyId.       │
│                  │ Nullable — muitos contatos antigos = NULL.    │
├──────────────────┼──────────────────────────────────────────────┤
│ name             │ pushName ou nome personalizado pelo usuário.  │
├──────────────────┼──────────────────────────────────────────────┤
│ companyId        │ FK → Company. Escopo de isolamento.           │
└──────────────────┴──────────────────────────────────────────────┘

Constraints existentes:
  • number_companyid_unique (number, companyId) — UNIQUE
  • contacts_remotejid_companyid_unique (remoteJid, companyId) — UNIQUE
  • contacts_canonical_company_idx (canonicalNumber, companyId) — UNIQUE PARCIAL

Índices:
  • idx_contact_number, idx_contact_name, idx_contact_company_id
  • idx_contact_whatsapp_id
```

### 1.2 Modelo de Dados — Ticket

```
Tabela: Tickets
  • contactId (FK → Contacts.id) — sem campo alternativo
  • whatsappId (FK → Whatsapps.id)
  • status: open | pending | closed | group | nps | lgpd | bot | campaign

FindOrCreateTicketService busca:
  WHERE contactId = ? AND companyId = ? AND whatsappId = ?
        AND status IN ('open','pending','group','nps','lgpd','bot','campaign')

⚠️ Se contactId é errado, TUDO é errado: ticket, mensagens, notificações.
```

### 1.3 Modelo de Dados — LidMapping

```
Tabela: LidMappings
  • lid (STRING) + companyId = UNIQUE
  • phoneNumber (STRING)
  • whatsappId, source, confidence
  
⚠️ Não tem campo "isVerified". Campo "confidence" (0.0-1.0) é subjetivo.
⚠️ Campos "source" e "confidence" foram adicionados manualmente mas NÃO
   existem na migration original — potencial erro de schema.
```

### 1.4 Fluxo de Código Atual (Mapa de Responsabilidades)

```
Mensagem Baileys
     │
     ▼
getContactMessage()               ← 300+ linhas, retorna {id, name}
│ • Extrai remoteJid, participant
│ • Se LID+fromMe: tenta 6 estratégias para resolver PN
│ • Se grupo: extrai participant com 5 fallbacks
│ • Duplica lógica de LidMapping.upsert
│ • Duplica lógica de signalRepository.getPNForLID
│
     ▼
verifyContact()                   ← 500+ linhas, retorna Contact
│ • Recebe {id, name} de getContactMessage
│ • Se LID: tenta 9 estratégias para encontrar contato
│ • Faz queries ao banco em cada estratégia (potencial N+1)
│ • Cria contato temporário com LID se nada funciona
│ • Duplica lógica de LidMapping, signalRepository, etc.
│
     ▼
CreateOrUpdateContactService()    ← 600+ linhas, retorna Contact
│ • Recebe {name, number, remoteJid} de verifyContact
│ • Busca por canonicalNumber OR number OR remoteJid
│ • Tenta mesclar duplicados LID por nome (frágil)
│ • Aplica normalização, tags, avatar
│
     ▼
FindOrCreateTicketService()       ← 400+ linhas, retorna Ticket
│ • Busca por contactId + whatsappId + status
│ • Se não acha: busca por timeCreateNewTicket
│ • Se não acha: cria novo
```

### 1.5 Pontos de Entrada de Contato (6 caminhos)

| # | Origem | Arquivo | Risco |
|---|--------|---------|-------|
| 1 | Mensagem recebida (Baileys) | wbotMessageListener.ts | ALTO — fluxo LID |
| 2 | Webhook API Oficial | ProcessWhatsAppWebhook.ts | MÉDIO — ID Meta |
| 3 | Importação CSV/Excel | CreateOrUpdateContactServiceForImport.ts | BAIXO |
| 4 | Inclusão manual (UI) | CreateContactService.ts | BAIXO |
| 5 | API externa | ContactController.ts | BAIXO |
| 6 | Campanhas | CampaignController/queues | BAIXO |

---

## 2. DIAGNÓSTICO — 7 PROBLEMAS ESTRUTURAIS

### P1: Tripla Identidade sem Hierarquia

O Contact tem 3 campos de identidade (`number`, `canonicalNumber`, `remoteJid`) sem
uma regra clara de qual é a "verdade". Diferentes partes do código buscam por campos
diferentes:

```
getContactMessage    → resolve para PN (tenta converter LID→PN)
verifyContact        → busca por remoteJid, depois canonicalNumber, depois number
CreateOrUpdate...    → busca por canonicalNumber OR number OR remoteJid
FindOrCreateTicket   → busca por contactId (resultado de toda a cadeia)
```

**Consequência:** O mesmo contato real pode existir em até 3 registros diferentes se
os campos não baterem.

### P2: Responsabilidades Sobrepostas

`getContactMessage` e `verifyContact` AMBOS tentam resolver LID→PN. A lógica é
**duplicada** e **inconsistente** entre eles:

- `getContactMessage`: usa signalRepository, LidMapping, senderPn, store.contacts, pushName
- `verifyContact`: usa LidMapping, signalRepository, remoteJid, pushName, store.contacts, onWhatsApp, busca parcial

Se `getContactMessage` resolve o LID com sucesso, `verifyContact` faz queries
desnecessárias. Se NÃO resolve, `verifyContact` tenta as mesmas coisas de novo.

### P3: Coluna `number` usada para LIDs

Quando LID não resolve, o sistema armazena os dígitos do LID em `number`:
```
number = "247540473708749"   ← dígitos do LID
canonicalNumber = NULL        ← normalização falha (não é telefone)
remoteJid = "247540473708749@lid"
```

Isso cria um "contato fantasma" que NUNCA se reconcilia com o contato real porque:
1. `number` tem UNIQUE constraint → impede criar contato real depois
2. `canonicalNumber` é NULL → busca por canonical não encontra
3. O contato fica "órfão" para sempre

### P4: Busca por Nome para Mesclar (Frágil)

`CreateOrUpdateContactService` tenta mesclar LIDs duplicados buscando por **nome**:
```typescript
lidContactToMerge = await Contact.findOne({
  where: {
    name: effectiveName,
    remoteJid: { [Op.like]: '%@lid' },
  }
});
```

**Problemas:**
- `pushName` muda frequentemente (emojis, apelidos, etc.)
- Nomes não são únicos — "João" pode ser qualquer pessoa
- Se nome não bate exatamente, não mescla → duplica

### P5: Race Condition na Criação

O fluxo getContact → verifyContact → CreateOrUpdate → FindOrCreateTicket
são 4 operações separadas sem transação. Duas mensagens do mesmo contato
chegando simultaneamente podem:
1. Ambas passarem por `getContactMessage` ao mesmo tempo
2. Ambas chegarem em `verifyContact` sem encontrar contato
3. Ambas criarem contatos duplicados
4. Cada uma criando seu próprio ticket

O `withJidLock` no final de verifyContact protege parcialmente, mas só
para contatos LID, e só dentro de uma instância do processo.

### P6: LidMapping sem Integração Real

A tabela `LidMappings` foi criada como remendo, não como peça central:
- Campos `source` e `confidence` podem não existir no schema real
- Não é consultada pelo `FindOrCreateTicketService`
- Não é consultada pelo `CreateOrUpdateContactService` (exceto indiretamente)
- O evento `lid-mapping.update` salva mapeamentos mas não reconcilia contatos existentes

### P7: A Proposta v1 Estava Over-Engineered

A proposta anterior sugeria:
- Nova tabela `ContactIdentifiers` (N:1) — complexidade desnecessária
- `canonicalId` prefixado ("lid:..." / "pn:...") — formato estranho no banco
- `primaryLid` + `primaryPn` separados — duplica informação que já temos
- `canonicalContactId` no Ticket — FK duplicada

**Problema:** Cria mais tabelas e campos sem resolver o problema fundamental,
que é: **o código não sabe qual campo consultar para encontrar um contato.**

---

## 3. SOLUÇÃO DEFINITIVA — "PN-FIRST COM LID-INDEX"

### 3.1 Princípio Fundamental

Apesar do Baileys dizer "migrate to LIDs", o **nosso sistema é um CRM** que precisa
mostrar números de telefone reais para os atendentes. LID é um identificador interno
do WhatsApp, não um identificador de negócio.

**Regra de ouro:** O `number`/`canonicalNumber` do Contact é SEMPRE um número de
telefone real. LID é APENAS um índice de lookup, nunca um identificador primário.

```
ANTES (errado):
  Contact.number = "247540473708749"  ← dígitos do LID no lugar de telefone

DEPOIS (correto):
  Contact.number = "5515999887766"    ← SEMPRE número real
  Contact.lidJid = "247540473708749@lid"  ← coluna separada, nullable
  Contact.remoteJid = "5515999887766@s.whatsapp.net"  ← JID principal
```

### 3.2 Mudanças no Modelo de Dados

#### A) Contact — Novo campo `lidJid`

```sql
ALTER TABLE "Contacts" ADD COLUMN "lidJid" VARCHAR(255);
CREATE UNIQUE INDEX contacts_lidjid_company_unique
  ON "Contacts"("lidJid", "companyId")
  WHERE "lidJid" IS NOT NULL;
```

**Semântica dos campos após a mudança:**

| Campo | Contém | Obrigatório | Único |
|-------|--------|-------------|-------|
| `number` | Telefone real ("5515999...") ou grupo ID | SIM | SIM (+ companyId) |
| `canonicalNumber` | Telefone normalizado (BeforeSave hook) | Não (null p/ grupo) | SIM parcial |
| `remoteJid` | JID principal (PN@s.whatsapp.net) | Não | SIM (+ companyId) |
| `lidJid` **(NOVO)** | LID completo (xxx@lid) se conhecido | Não | SIM parcial |

#### B) LidMapping — Simplificar

```sql
-- Remover campos subjetivos (confidence, source)
-- Adicionar campo verified
ALTER TABLE "LidMappings" DROP COLUMN IF EXISTS "confidence";
ALTER TABLE "LidMappings" DROP COLUMN IF EXISTS "source";
ALTER TABLE "LidMappings" ADD COLUMN "verified" BOOLEAN DEFAULT false;
```

#### C) Ticket — Sem mudança

`contactId` continua sendo a FK. Se o Contact é correto, o Ticket é correto.
Não precisa de campo extra.

### 3.3 Novo Fluxo de Resolução (3 camadas limpas)

```
CAMADA 1: EXTRAÇÃO (pura, sem I/O de banco)
─────────────────────────────────────────────
extractMessageIdentifiers(msg: IWebMessageInfo)
  → { pnJid: string|null, lidJid: string|null, pushName: string, isGroup: boolean }

  Regras:
  1. isGroup = remoteJid.includes("@g.us")
  2. Se grupo: jid = participant || participantAlt
  3. Se DM:   jid = remoteJid
  4. Se jid é @lid:
     a. lidJid = jid
     b. pnJid = remoteJidAlt || participantAlt || null
  5. Se jid é @s.whatsapp.net:
     a. pnJid = jid
     b. lidJid = null (ou se msg tiver campo lid, guardar)
  6. Se jid é @lid e NÃO tem Alt:
     a. Consultar signalRepository.getPNForLID (in-memory, sem I/O)
     b. Se resolveu: pnJid = resultado
     c. Se não: pnJid = null
  
  Retorno DETERMINÍSTICO: zero banco, zero efeito colateral.


CAMADA 2: RESOLUÇÃO (busca no banco, sem criação)
──────────────────────────────────────────────────
resolveContact(ids: ExtractedIds, companyId: number)
  → Contact | null

  Ordem de busca (curto-circuito no primeiro match):
  1. Se pnJid:  buscar por canonicalNumber = normalize(pnJid)
  2. Se lidJid: buscar por lidJid = lidJid
  3. Se lidJid: consultar LidMapping → obter PN → buscar por canonicalNumber
  4. Se nada encontrou: return null

  Efeito colateral ÚNICO: se encontrou contato e lidJid novo,
  UPDATE Contact SET lidJid = ? WHERE id = ?  (atômico)


CAMADA 3: CRIAÇÃO (só quando resolução retorna null)
─────────────────────────────────────────────────────
createContact(ids: ExtractedIds, companyId: number, wbot: Session)
  → Contact

  Regras:
  A. Se temos pnJid (sabemos o número real):
     → Criar com number = normalize(pnJid), lidJid = ids.lidJid
  
  B. Se SÓ temos lidJid (não sabemos o número):
     → NÃO CRIAR CONTATO COM LID COMO NÚMERO
     → Consultar LidMapping uma vez mais
     → Se encontrou PN: criar com number = PN
     → Se NÃO encontrou: criar contato PENDENTE:
        number = "PENDING_<lidJid>"  (marcador explícito)
        lidJid = lidJid
        status = 'pending_resolution'
     → Job assíncrono tentará resolver depois

  C. Se é grupo:
     → Criar com number = groupId@g.us (sem mudança)
```

### 3.4 Job Assíncrono de Reconciliação

```typescript
// Roda a cada 60 segundos
async function reconcilePendingLidContacts(companyId: number) {
  // 1. Buscar contatos com number LIKE 'PENDING_%'
  const pending = await Contact.findAll({
    where: { number: { [Op.like]: 'PENDING_%' }, companyId }
  });
  
  for (const contact of pending) {
    // 2. Consultar LidMapping
    const mapping = await LidMapping.findOne({
      where: { lid: contact.lidJid, companyId }
    });
    
    if (mapping?.phoneNumber) {
      // 3. Verificar se já existe contato real com esse número
      const real = await Contact.findOne({
        where: { canonicalNumber: mapping.phoneNumber, companyId }
      });
      
      if (real) {
        // 4a. MERGE: transferir tickets do contato pendente para o real
        await Ticket.update(
          { contactId: real.id },
          { where: { contactId: contact.id } }
        );
        await Message.update(
          { contactId: real.id },
          { where: { contactId: contact.id } }
        );
        // Atualizar lidJid do contato real
        await real.update({ lidJid: contact.lidJid });
        // Apagar contato fantasma
        await contact.destroy();
      } else {
        // 4b. PROMOVER: transformar contato pendente em real
        await contact.update({
          number: mapping.phoneNumber,
          canonicalNumber: mapping.phoneNumber,
          remoteJid: `${mapping.phoneNumber}@s.whatsapp.net`
        });
      }
    }
  }
}
```

### 3.5 Listener lid-mapping.update (Simplificado)

```typescript
wbot.ev.on("lid-mapping.update", async (mappings) => {
  for (const { lid, pn } of mappings) {
    const pnDigits = pn.replace(/\D/g, "");
    
    // 1. Salvar mapeamento
    await LidMapping.upsert({
      lid, phoneNumber: pnDigits, companyId, whatsappId, verified: true
    });
    
    // 2. Atualizar contatos que tenham esse LID
    const contact = await Contact.findOne({
      where: { lidJid: lid, companyId }
    });
    
    if (contact && contact.number.startsWith("PENDING_")) {
      // Contato pendente → resolver agora
      // (mesma lógica do job de reconciliação)
    } else if (contact) {
      // Contato já resolvido → só garantir consistência
      // (nada a fazer)
    }
  }
});
```

---

## 4. COMPARAÇÃO: ANTES vs DEPOIS

### getContactMessage (300+ linhas → ~40 linhas)

```
ANTES: 6 estratégias de resolução LID com I/O de banco, duplicação de lógica
DEPOIS: Função pura que extrai campos da mensagem. Sem I/O.
```

### verifyContact (500+ linhas → ~60 linhas)

```
ANTES: 9 estratégias em cascata, cada uma fazendo queries ao banco
DEPOIS: 3 buscas no banco (canonicalNumber, lidJid, LidMapping) e criação se necessário
```

### CreateOrUpdateContactService (600+ linhas → sem mudança estrutural)

```
ANTES: Busca por nome para mesclar LIDs (frágil)
DEPOIS: Recebe número real (já resolvido). Busca apenas por canonical/number/remoteJid.
        Remove lógica de mesclagem por nome.
```

---

## 5. PLANO DE IMPLEMENTAÇÃO

### Fase 1: Migration + Modelo (sem quebrar nada)

1. Criar migration para adicionar coluna `lidJid` ao Contact
2. Criar índice único parcial `(lidJid, companyId)`
3. Atualizar modelo Contact.ts com novo campo
4. Popular `lidJid` a partir de `remoteJid` existentes que contenham `@lid`
5. Limpar campos `source`/`confidence` do LidMapping se não existirem no schema

### Fase 2: Novo serviço de resolução

1. Criar `services/ContactResolution/extractMessageIdentifiers.ts` (camada 1)
2. Criar `services/ContactResolution/resolveContact.ts` (camada 2)
3. Criar `services/ContactResolution/createContact.ts` (camada 3)
4. Criar `services/ContactResolution/ContactResolverService.ts` (orquestrador)
5. Todas as funções com < 100 linhas, testáveis isoladamente

### Fase 3: Substituição gradual

1. Substituir `getContactMessage` + `verifyContact` por `ContactResolverService`
   no `wbotMessageListener.ts`
2. Atualizar `StartWhatsAppSessionUnified.ts` para usar listener simplificado
3. Remover código morto (estratégias antigas)

### Fase 4: Reconciliação

1. Criar job assíncrono para reconciliar contatos `PENDING_*`
2. Criar script SQL para limpar contatos fantasma existentes
3. Monitorar métricas: contatos pending, duplicados, tickets orfãos

---

## 6. RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|-------|-----------|
| Contatos existentes com LID em `number` | Migration popula `lidJid` e marca para reconciliação |
| LidMapping sem campos source/confidence | Migration normaliza schema antes de alterar |
| Mensagens de contatos PENDING sem número | UI mostra "Aguardando identificação" + job resolve |
| Race condition em criação | Constraint UNIQUE + retry com findOne no catch |
| Rollback necessário | Feature flag `USE_NEW_CONTACT_RESOLVER` no .env |

---

## 7. MÉTRICAS DE SUCESSO

- [ ] Zero contatos com dígitos de LID em `number` (novo)
- [ ] Zero tickets duplicados para o mesmo contato real
- [ ] Zero mensagens em tickets errados
- [ ] `getContactMessage` < 50 linhas, sem I/O
- [ ] `verifyContact` substituído por < 100 linhas
- [ ] Tempo de resolução de contato < 50ms (P99)

---

**Status:** Aguardando validação para iniciar implementação
