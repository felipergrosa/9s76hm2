# Fluxo de Contatos - Whaticket

## Visão Geral

O sistema de contatos do Whaticket gerencia três tipos de entidades:

| Tipo | Identificador | isGroup | Exemplo |
|------|---------------|---------|---------|
| **Indivíduo com número** | `@s.whatsapp.net` | `false` | `5519998765432@s.whatsapp.net` |
| **Indivíduo com LID** | `@lid` | `false` | `123456789012345@lid` |
| **Grupo** | `@g.us` | `true` | `120363012345678901@g.us` |

---

## Camadas de Resolução de Contato

### **Camada 1: Extração (`extractMessageIdentifiers`)**
*Sem I/O de banco - pura extração de dados da mensagem Baileys*

```
Mensagem Baileys → Extrai:
├── pnJid (Phone Number JID) - número real @s.whatsapp.net
├── lidJid (LID JID) - identificador LID @lid
├── pushName - nome do contato
├── isGroup - se mensagem é de grupo
├── groupJid - JID do grupo (se aplicável)
└── isFromMe - se mensagem enviada por nós
```

**Estratégias de resolução LID→PN (ordem de prioridade):**
1. `altJid` - campo alternativo do Baileys
2. `signalRepository.getPNForLID()` - cache in-memory
3. `senderPn` - campo do Baileys
4. `participantPn` - campo do Baileys v7
5. `store.contacts` - cache do socket
6. `pushName` - se parece com número válido

---

### **Camada 2: Resolução (`resolveContact`)**
*Busca contato existente no banco - até 3 queries*

```
Busca em ordem:
1. Por pnJid (número real) → match exato
2. Por lidJid → match exato
3. Por LidMapping → mapeamento LID↔PN
4. Por canonicalNumber → número normalizado
5. Por groupJid (grupos) → match exato
```

---

### **Camada 3: Criação (`CreateOrUpdateContactService`)**
*Último recurso - cria novo contato*

```
Se temos PN (número real):
├── number = dígitos do telefone
├── name = pushName ou número
└── isGroup = false

Se temos apenas LID:
├── number = PENDING_<lid>  ← CORRIGIDO
├── name = pushName ou "Contato"
├── isGroup = false
└── lidJid = LID para reconciliação futura

Se é grupo:
├── number = groupJid completo (@g.us)
├── name = subject do grupo
└── isGroup = true
```

---

## Eventos Baileys e Tratamento

### **`messages.upsert`** - Mensagens recebidas/enviadas
```typescript
// Fluxo principal
msg → extractMessageIdentifiers → resolveContact → CreateOrUpdateContactService
```

### **`contacts.update`** - Atualização de contatos
```typescript
// CORRIGIDO: Validação robusta de isGroup
if (contactId.endsWith("@g.us") || (contactId.includes("-") && contactId.endsWith("@g.us"))) {
  // Ignorar - grupos são tratados em groups.update
  return;
}
// Processar apenas indivíduos
```

### **`groups.update`** - Atualização de grupos
```typescript
// Criar/atualizar contato do grupo
{
  name: group.subject,
  number: group.id,  // @g.us
  isGroup: true
}
```

---

## Validações Implementadas

### **1. Número vs Nome**
```typescript
// BLOQUEADO: nome no lugar do número
if (number === name && !number.includes("@") && !isPhoneNumber(number)) {
  return null; // Rejeitado
}
```

### **2. isGroup vs Identificador**
```typescript
// BLOQUEADO: inconsistência
if (!isGroup && number.includes("@g.us")) {
  return null; // isGroup=false mas número é de grupo
}
```

### **3. LID como número**
```typescript
// BLOQUEADO: LID puro como número (>13 dígitos)
if (numberDigitsOnly.length > 13 && !number.startsWith("PENDING_")) {
  return null; // Parece ser ID Meta/Facebook
}
```

---

## Reconciliação de LID

Quando o número real é descoberto (via evento `lid-mapping.update`):

```typescript
// 1. Buscar contato pelo LID
const contact = await Contact.findOne({ where: { lidJid } });

// 2. Atualizar com número real
await contact.update({
  number: phoneNumber,
  remoteJid: `${phoneNumber}@s.whatsapp.net`
});

// 3. Persistir mapeamento
await LidMapping.upsert({ lid, phoneNumber, verified: true });
```

---

## Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Nome no lugar do número | `number: contactName` | `number: PENDING_<lid>` |
| Indivíduo como grupo | `isGroup` detectado errado | Validação explícita de @g.us |
| LID não resolvido | Sem mapeamento | Aguardar evento `lid-mapping.update` |
| Contato duplicado | Busca não encontrou | Usar `[Op.or]` com múltiplos campos |

---

## Scripts de Manutenção

### **Limpeza de contatos corrompidos**
```bash
cd backend
node fix-contacts.js
```

### **Diagnóstico**
```bash
cd backend
node diag-contacts.js
```

---

## Referências

- **Baileys Documentation**: https://github.com/WhiskeySockets/Baileys
- **WhatsApp LID Migration**: Baileys v6.8+ recomenda usar LIDs como identificador principal
- **Phone Validation**: `MAX_PHONE_DIGITS = 13` (padrão brasileiro com 9 dígitos)
