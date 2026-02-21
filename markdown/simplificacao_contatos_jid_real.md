# Simplificação de Criação de Contatos — Apenas JID Real

## Regras de Negócio

```mermaid
flowchart TD
    A[Mensagem recebida] --> B{JID é @s.whatsapp.net?}
    B -->|Sim| C[Extrair número do JID]
    B -->|Não - é @lid| D{LID resolvido?}
    D -->|Sim - LidMappings/signalRepository| C
    D -->|Não| E["return null<br>(aguarda lid-mapping.update)"]
    
    C --> F{Contato existe?}
    F -->|Sim| G{Tem nome real?}
    G -->|Sim| H[Manter nome existente]
    G -->|Não - nome é número| I{pushName disponível?}
    I -->|Sim| J[name = pushName]
    I -->|Não| K[name permanece = número]
    
    F -->|Não| L["Criar contato<br>name = number = JID digits"]
    L --> M{pushName na mensagem?}
    M -->|Sim| N[name = pushName]
    M -->|Não| O[name = número]
    
    C --> P{JID é @s.whatsapp.net?}
    P -->|Sim| Q["Buscar profilePicture<br>wbot.profilePictureUrl()"]
    P -->|Não| R[profilePic = vazio]
```

## Mudanças Implementadas

### 1. `wbotMessageListener.ts` — verifyContact

**LID não resolvido = return null**
- Removidas ~120 linhas de criação de contato temporário LID
- Mantidas todas as estratégias de resolução (LidMappings, signalRepository, store.contacts)
- Se nenhuma resolver → mensagem ignorada (será processada quando lid-mapping.update resolver)

**Profile Picture proativa**
- Para JIDs `@s.whatsapp.net`, busca `wbot.profilePictureUrl()` ao criar contato

### 2. `CreateOrUpdateContactService.ts`

**pushName substitui nome-número automaticamente**
```typescript
if (pushName) {
  contact.pushName = pushName;
  const isNameJustNumber = !contact.name || currentNameClean === String(number);
  if (isNameJustNumber) {
    contactData.name = pushName;  // Substitui número pelo nome real
  }
}
```

**Guard contra LIDs**
- Rejeita números > 14 dígitos (formato de LID)
- Lança exceção para prevenir qualquer fluxo futuro de salvar LID como número

### 3. `wbotMonitor.ts` — lid-mapping.update

**Profile Picture ao promover contato**
- Quando contato PENDING_ é promovido a real, busca foto do Baileys usando JID real
