# Análise de Fontes para Resolução LID → PhoneNumber

## Fontes Baileys v7

### 1. `lid-mapping.update` ⭐⭐⭐⭐⭐ (MELHOR)
- **Confiabilidade:** 100% quando disponível
- **Quando dispara:** Quando o WhatsApp resolve LID → PN internamente
- **Dados:** `{ mapping: { "176609088803005@lid": "5519989848513" } }`
- **Implementado em:** `wbotMonitor.ts`
- **Problema:** Não dispara para todos os LIDs, apenas quando há interação recente

### 2. `signalRepository.lidMapping.getPNForLID()` ⭐⭐⭐⭐
- **Confiabilidade:** 100% quando disponível
- **Tipo:** Método síncrono no store do Baileys
- **Uso:** `wbot.signalRepository.lidMapping.getPNForLID("176609088803005")`
- **Problema:** Requer que o mapeamento já tenha sido resolvido pelo WhatsApp

### 3. `contacts.update` ⭐⭐⭐
- **Confiabilidade:** ~60% (nem sempre traz phoneNumber)
- **Dados:** `{ id: "176609088803005@lid", notify: "Ricardo Almeida", phoneNumber?: "5519989848513" }`
- **Problema:** `phoneNumber` é opcional e frequentemente ausente

### 4. `messages.upsert` ⭐⭐
- **Confiabilidade:** ~30% (apenas pushName)
- **Dados:** `msg.key.participant = "176609088803005@lid", msg.pushName = "Ricardo Almeida"`
- **Problema:** Não traz phoneNumber, apenas nome

### 5. `groupMetadata` ⭐
- **Confiabilidade:** ~10% (apenas para participantes @s.whatsapp.net)
- **Dados:** `participants[].id = "5519989848513@s.whatsapp.net"` ou `"176609088803005@lid"`
- **Problema:** LIDs não têm phoneNumber no metadata

## Fontes Não-Baileys

### 1. Tabela `LidMapping` (persistência) ⭐⭐⭐⭐⭐
- **Confiabilidade:** 100% se já foi resolvido
- **Tipo:** Persistência no banco de dados
- **Fonte:** Acumulado de todas as fontes acima

### 2. `onWhatsApp()` ⭐⭐
- **Confiabilidade:** 100% para verificar se número existe
- **Tipo:** API do WhatsApp
- **Uso:** `wbot.onWhatsApp("5519989848513")`
- **Problema:** Requer o número como entrada, não resolve LID

### 3. `profilePictureUrl()` ⭐
- **Confiabilidade:** 0% para phoneNumber
- **Tipo:** API do WhatsApp
- **Uso:** `wbot.profilePictureUrl(jid)`
- **Problema:** Apenas retorna URL da foto, não phoneNumber

## Estratégia Recomendada

### Fluxo Otimizado:

```
┌─────────────────────────────────────────────────────────────┐
│                RESOLUÇÃO LID → PHONE NUMBER                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. EVENTO lid-mapping.update (Baileys v7)                  │
│    └─ Dispara automaticamente quando WhatsApp resolve       │
│    └─ Salva em LidMapping com confidence=1.0, verified=true │
│                                                             │
│ 2. signalRepository.lidMapping.getPNForLID()                │
│    └─ Consulta store interno do Baileys                     │
│    └─ Disponível após interação recente                     │
│                                                             │
│ 3. contacts.update com phoneNumber                          │
│    └─ Evento disparado pelo Baileys                         │
│    └~ Nem sempre disponível                                 │
│                                                             │
│ 4. Tabela LidMapping (persistência)                         │
│    └─ Fallback para mapeamentos já resolvidos               │
│                                                             │
│ 5. Busca por nome/contato existente                         │
│    └─ Associação manual ou por correspondência de nome      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Limitações

O WhatsApp **intencionalmente** não expõe phoneNumber de LIDs em todos os eventos. Isso é uma limitação de privacidade do protocolo. O evento `lid-mapping.update` é a única fonte 100% confiável, mas depende de:

1. O usuário ter interagido recentemente
2. O WhatsApp ter resolvido o LID internamente
3. A sessão estar conectada no momento da resolução

## Melhoria Proposta

Adicionar polling periódico do `signalRepository.lidMapping` para LIDs não resolvidos:

```typescript
// Executar a cada 5 minutos para LIDs pendentes
setInterval(async () => {
  const unresolvedLids = await getUnresolvedLids();
  for (const lid of unresolvedLids) {
    const pn = await wbot.signalRepository?.lidMapping?.getPNForLID(lid);
    if (pn) {
      await LidMapping.upsert({ lid, phoneNumber: pn, verified: true });
    }
  }
}, 5 * 60 * 1000);
```
