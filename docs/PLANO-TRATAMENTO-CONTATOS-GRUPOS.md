# 📋 PLANO ESTRUTURADO: Tratamento Definitivo de Contatos e Grupos

**Modo:** N1 (Production)  
**Data:** 2026-02-06  
**Versão:** 1.0

---

## 🎯 Objetivo

Implementar um sistema robusto e definitivo para tratamento de contatos e grupos do WhatsApp, garantindo:
- Zero perda de contatos
- Zero perda de grupos
- Resolução correta de LIDs (Linked Device Identifiers)
- Prevenção de duplicados
- Compatibilidade com Baileys v7.x

---

## 📚 Pesquisa: Documentação Oficial Baileys v7

### O que são LIDs?

O WhatsApp implementou o sistema **LID (Linked Device Identifier)** para garantir privacidade dos usuários em grupos grandes. Cada usuário tem um LID único associado ao seu número de telefone (PN - Phone Number).

**Formato:**
- **PN (Phone Number):** `5511999999999@s.whatsapp.net` (formato antigo)
- **LID (Linked Device ID):** `249593652629520@lid` (formato novo)
- **Grupo:** `120363310112264901@g.us`

### Recursos do Baileys v7 para LIDs

```typescript
// Store de mapeamento LID ↔ PN
const store = sock.signalRepository.lidMapping;

// Métodos disponíveis:
store.storeLIDPNMapping(lid, pn)  // Armazenar mapeamento
store.getLIDForPN(pn)             // Obter LID a partir do PN
store.getPNForLID(lid)            // Obter PN a partir do LID (MAIS IMPORTANTE!)

// Evento de atualização de mapeamento (NÃO CONFIÁVEL - WIP)
sock.ev.on('lid-mapping.update', (update) => {
  // update.mapping contém novos pares LID↔PN
});

// Campos alternativos nas mensagens (v6.8.0+)
msg.key.remoteJidAlt  // JID alternativo para DMs
msg.key.participantAlt // JID alternativo para grupos
```

### Problemas Conhecidos (Issues do Baileys)

1. **#1718, #2030, #2154:** LIDs em chamadas/eventos não resolvem para PN
2. **#2263:** Evento `lid-mapping.update` nem sempre dispara
3. **Recomendação oficial:** "MIGRATE TO LIDs. PNs are WAY LESS RELIABLE."

### Como Outras Plataformas Tratam

**Chatwoot (Issue #12695):**
- Mesmo problema: conversas duplicadas com @lid e @s.whatsapp.net
- Solução proposta: unificar contatos por mapeamento LID↔PN

---

## 🔍 Análise do Código Atual (Gaps Identificados)

### ✅ O que já funciona

1. **Detecção de LIDs:** `msgContact.id.includes("@lid")`
2. **Resolução via `signalRepository.lidMapping.getPNForLID()`**
3. **Cache persistente:** Tabela `LidMappings`
4. **Fallbacks:** pushName, store.contacts, onWhatsApp, busca parcial
5. **Lock por JID:** Evita race conditions

### ❌ Gaps Identificados

| Gap | Descrição | Impacto |
|-----|-----------|---------|
| **G1** | Grupos criados sem `@g.us` no número | Grupos não aparecem no frontend |
| **G2** | LIDs salvos como contatos com 14-15 dígitos | Duplicados |
| **G3** | Não usa `remoteJidAlt`/`participantAlt` | Perde mapeamento |
| **G4** | Evento `lid-mapping.update` não processado | Mapeamentos perdidos |
| **G5** | Grupos com `isGroup=true` mas sem `@g.us` | Inconsistência de dados |
| **G6** | Frontend filtra `isGroup: false` fixo | Grupos não aparecem |
| **G7** | Não há tela de gerenciamento de grupos | UX incompleta |

---

## 🏗️ Arquitetura Proposta

### Modelo de Dados (Contact)

```
Contact {
  id: number
  number: string           // Número canônico (ex: 5511999999999)
  canonicalNumber: string  // Número normalizado para busca
  remoteJid: string        // JID completo (pode ser LID ou PN)
  lidJid: string           // LID se conhecido (NOVO CAMPO)
  pnJid: string            // PN se conhecido (NOVO CAMPO)
  isGroup: boolean         // true para grupos
  isLinkedDevice: boolean  // true se contato veio de LID (INFERIDO)
  companyId: number
  ...
}
```

### Modelo de Dados (LidMapping)

```
LidMapping {
  id: number
  lid: string              // Ex: 249593652629520@lid
  phoneNumber: string      // Ex: 5511999999999
  pnJid: string            // Ex: 5511999999999@s.whatsapp.net
  companyId: number
  whatsappId: number
  source: string           // 'baileys' | 'manual' | 'message'
  confidence: number       // 0-100 (confiabilidade)
  createdAt: Date
  updatedAt: Date
}
```

### Fluxo de Resolução de Contatos

```
┌─────────────────────────────────────────────────────────────────┐
│                    MENSAGEM RECEBIDA                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. EXTRAIR JID                                                   │
│    - Verificar remoteJidAlt / participantAlt                     │
│    - Identificar tipo: @s.whatsapp.net, @lid, @g.us              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌────────┐     ┌────────┐     ┌────────┐
         │ GRUPO  │     │  LID   │     │   PN   │
         │ @g.us  │     │  @lid  │     │ @s.w.n │
         └────────┘     └────────┘     └────────┘
              │               │               │
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Buscar por JID  │ │ RESOLVER LID    │ │ Buscar por PN   │
│ isGroup=true    │ │ (ver abaixo)    │ │ canonicalNumber │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Fluxo de Resolução de LID

```
┌─────────────────────────────────────────────────────────────────┐
│                    LID DETECTADO (@lid)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 1: Verificar remoteJidAlt / participantAlt                │
│          → Se disponível, usar como PN                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 2: signalRepository.lidMapping.getPNForLID()              │
│          → Método oficial do Baileys v7                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 3: Tabela LidMappings (cache persistente)                 │
│          → Mapeamentos salvos anteriormente                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 4: Buscar contato por remoteJid = LID                     │
│          → Contato já foi criado com este LID                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 5: store.contacts (cache do Baileys)                      │
│          → Pode ter informações adicionais                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 6: Criar contato temporário com LID                       │
│          → Marcar como isLinkedDevice = true                     │
│          → Será mesclado quando mapeamento for descoberto        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Plano de Implementação

### Fase 1: Correção de Dados (Imediato) ✅ CONCLUÍDA

- [x] Corrigir grupos sem `@g.us` no número
- [x] Remover LIDs órfãos (sem tickets)
- [x] Identificar LIDs com tickets

### Fase 2: Backend - Melhorias no Tratamento de LIDs

#### 2.1 Processar evento `lid-mapping.update`

```typescript
// Em wbotMessageListener.ts ou StartWhatsAppSession.ts
wbot.ev.on('lid-mapping.update', async (update) => {
  for (const [lid, pn] of Object.entries(update.mapping)) {
    await LidMapping.upsert({
      lid: `${lid}@lid`,
      phoneNumber: pn.replace(/\D/g, ''),
      pnJid: `${pn}@s.whatsapp.net`,
      companyId,
      whatsappId: wbot.id,
      source: 'baileys'
    });
    
    // Mesclar contatos duplicados automaticamente
    await mergeLidWithRealContact(lid, pn, companyId);
  }
});
```

#### 2.2 Usar `remoteJidAlt` / `participantAlt`

```typescript
const getContactMessage = async (msg, wbot) => {
  // NOVO: Priorizar JIDs alternativos
  const remoteJidAlt = msg.key.remoteJidAlt;
  const participantAlt = msg.key.participantAlt;
  
  // Se temos o alternativo (PN), usar ele
  if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
    // Salvar mapeamento para futuro
    if (msg.key.remoteJid.includes('@lid')) {
      await saveLidMapping(msg.key.remoteJid, remoteJidAlt);
    }
    return remoteJidAlt;
  }
  
  // ... resto da lógica
};
```

#### 2.3 Validação Robusta de Grupos

```typescript
const isValidGroup = (jid: string, isGroup: boolean) => {
  const hasGus = jid.includes('@g.us');
  
  // Inconsistência: isGroup mas sem @g.us
  if (isGroup && !hasGus) {
    logger.warn('[isValidGroup] Grupo sem @g.us detectado', { jid });
    return { valid: false, fix: 'addGus' };
  }
  
  // Inconsistência: @g.us mas não isGroup
  if (hasGus && !isGroup) {
    logger.warn('[isValidGroup] @g.us sem isGroup', { jid });
    return { valid: false, fix: 'setIsGroup' };
  }
  
  return { valid: true };
};
```

#### 2.4 Serviço de Mesclagem Automática

```typescript
// ContactMergeService.ts
const mergeContacts = async (lidContactId: number, realContactId: number) => {
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Transferir tickets
    await Ticket.update(
      { contactId: realContactId },
      { where: { contactId: lidContactId }, transaction }
    );
    
    // 2. Transferir mensagens
    await Message.update(
      { contactId: realContactId },
      { where: { contactId: lidContactId }, transaction }
    );
    
    // 3. Copiar tags (sem duplicar)
    const lidTags = await ContactTag.findAll({ where: { contactId: lidContactId } });
    for (const tag of lidTags) {
      await ContactTag.findOrCreate({
        where: { contactId: realContactId, tagId: tag.tagId },
        defaults: { contactId: realContactId, tagId: tag.tagId },
        transaction
      });
    }
    
    // 4. Atualizar contato real com LID
    await Contact.update(
      { lidJid: lidContact.remoteJid },
      { where: { id: realContactId }, transaction }
    );
    
    // 5. Remover contato LID
    await ContactTag.destroy({ where: { contactId: lidContactId }, transaction });
    await Contact.destroy({ where: { id: lidContactId }, transaction });
    
    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

### Fase 3: Frontend - Gerenciamento de Grupos

#### 3.1 Criar Aba de Grupos

```javascript
// GroupsPage/index.js
const fetchGroups = async () => {
  const { data } = await api.get('/contacts/', {
    params: {
      isGroup: 'true',  // DIFERENÇA: filtrar grupos
      pageNumber,
      limit: 50
    }
  });
  return data;
};
```

#### 3.2 Adicionar Menu/Tab para Grupos

```javascript
// MainContainer ou Layout
<Tabs>
  <Tab label="Contatos" value="contacts" />
  <Tab label="Grupos" value="groups" />  {/* NOVO */}
</Tabs>
```

### Fase 4: Monitoramento e Prevenção

#### 4.1 Job de Verificação Periódica

```typescript
// VerifyContactsJob.ts (executar diariamente)
const verifyContacts = async () => {
  // 1. Grupos sem @g.us
  const invalidGroups = await Contact.findAll({
    where: {
      isGroup: true,
      number: { [Op.notLike]: '%@g.us' }
    }
  });
  
  for (const group of invalidGroups) {
    await group.update({ number: `${group.number}@g.us` });
  }
  
  // 2. LIDs que podem ser resolvidos
  const unresolvedLids = await Contact.findAll({
    where: {
      isGroup: false,
      [Op.and]: [
        Sequelize.where(
          Sequelize.fn('LENGTH', Sequelize.col('number')),
          { [Op.gte]: 14 }
        )
      ]
    }
  });
  
  for (const lid of unresolvedLids) {
    await tryResolveLid(lid);
  }
  
  // 3. Duplicados
  await findAndMergeDuplicates();
};
```

#### 4.2 Logs e Alertas

```typescript
// Métricas para monitorar
const METRICS = {
  'contacts.created': 0,
  'contacts.merged': 0,
  'lids.resolved': 0,
  'lids.unresolved': 0,
  'groups.created': 0,
  'groups.fixed': 0
};
```

---

## 🔧 Checklist de Implementação

### Backend

- [ ] Processar evento `lid-mapping.update`
- [ ] Usar `remoteJidAlt`/`participantAlt` nas mensagens
- [ ] Adicionar campos `lidJid` e `pnJid` ao modelo Contact
- [ ] Criar serviço `ContactMergeService`
- [ ] Criar job de verificação periódica
- [ ] Adicionar validação de grupos (garantir @g.us)
- [ ] Implementar endpoint `/contacts/groups` para listar grupos
- [ ] Logs estruturados para debugging

### Frontend

- [ ] Criar página/aba de Grupos
- [ ] Adicionar filtro isGroup na listagem
- [ ] Permitir visualização de grupos para admins
- [ ] Exibir indicador de "contato LID não resolvido"

### Banco de Dados

- [ ] Migration: adicionar `lidJid` e `pnJid` ao Contact
- [ ] Migration: adicionar `source` e `confidence` ao LidMapping
- [ ] Script de correção de dados existentes (já criado)

### Testes

- [ ] Teste: criar contato de LID
- [ ] Teste: mesclar contato LID com real
- [ ] Teste: criar grupo com @g.us
- [ ] Teste: validar que grupos aparecem corretamente
- [ ] Teste: job de verificação periódica

---

## 📊 Critérios de Sucesso

| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Contatos LID não resolvidos | 6+ | 0 | 0 |
| Grupos sem @g.us | 20 | 0 | 0 |
| Grupos visíveis no frontend | 0 | 20+ | 100% |
| Duplicados por LID | Vários | 0 | 0 |
| Perda de contatos | Possível | 0 | 0 |

---

## 🚀 Próximos Passos (Prioridade)

1. **IMEDIATO:** Executar script SQL de correção (já feito parcialmente)
2. **CURTO PRAZO:** Implementar Fase 2 (backend)
3. **MÉDIO PRAZO:** Implementar Fase 3 (frontend)
4. **LONGO PRAZO:** Implementar Fase 4 (monitoramento)

---

## 📚 Referências

- [Baileys v7 Migration Guide](https://baileys.wiki/docs/migration/to-v7.0.0/)
- [Baileys Issue #1718](https://github.com/WhiskeySockets/Baileys/issues/1718)
- [Baileys Issue #2030](https://github.com/WhiskeySockets/Baileys/issues/2030)
- [Baileys Issue #2263](https://github.com/WhiskeySockets/Baileys/issues/2263)
- [Chatwoot Issue #12695](https://github.com/chatwoot/chatwoot/issues/12695)
