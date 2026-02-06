# Mapa Mental: Fluxo de Resolução de Contatos (Arquitetura PN-First com LID-Index)

## Diagrama Visual em ASCII

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          MENSAGEM WHATSAPP (Baileys)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │ msg.key.remoteJid  →  "5515999999999@s.whatsapp.net" ou "123456789@lid"          │    │
│  │ msg.key.participant → "5515888888888@s.whatsapp.net" (grupos)                    │    │
│  │ msg.pushName        → "João Silva"                                             │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    CAMADA 1: EXTRAÇÃO (Pure Function - Zero I/O)                          │
│                    extractMessageIdentifiers.ts                                           │
│                                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                  │
│  │   Extrair PN     │    │   Extrair LID    │    │  Extrair Nome    │                  │
│  │   (Telefone)     │    │   (se existir)   │    │   (pushName)     │                  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                       │                            │
│           ▼                       ▼                       ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Resultado: { pnJid, lidJid, pushName, isGroup, canonicalNumber }                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    CAMADA 2: RESOLUÇÃO (Busca no Banco)                                  │
│                    resolveContact.ts                                                      │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ESTRATÉGIA 1: Buscar por canonicalNumber (telefone normalizado)                   │   │
│  │  SELECT * FROM Contacts WHERE canonicalNumber = '5515999999999' AND companyId=?   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                             │
│           │ NÃO ENCONTRADO                                                               │
│           ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ESTRATÉGIA 2: Buscar por lidJid (LID do WhatsApp)                               │   │
│  │  SELECT * FROM Contacts WHERE lidJid = '123456789@lid' AND companyId=?          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                             │
│           │ NÃO ENCONTRADO                                                               │
│           ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ESTRATÉGIA 3: Buscar na tabela LidMappings (cache de mapeamentos)              │   │
│  │  SELECT phoneNumber FROM LidMappings WHERE lid = '123456789@lid'               │   │
│  │  └── Se encontrado: retornar contato pelo phoneNumber                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                             │
│           │ NÃO ENCONTRADO                                                               │
│           ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  RESULTADO: Contato não existe no banco                                          │   │
│  │  → Passar para CAMADA 3 (Criação)                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    CAMADA 3: CRIAÇÃO (Último Recurso)                                    │
│                    createContact.ts                                                       │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  TEM NÚMERO DE TELEFONE? (pnJid válido)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                             │
│           ├────────────────── SIM ──────────────────┐                                   │
│           │                                         │                                   │
│           ▼                                         ▼                                   │
│  ┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │ Criar contato NORMAL            │    │ É GRUPO?                                │   │
│  │ number = telefone real          │    │ remoteJid termina em @g.us?             │   │
│  │ canonicalNumber = normalizado   │    └──────────────────┬─────────────────────┘   │
│  │ remoteJid = pnJid               │                       │                       │   │
│  │ lidJid = lidJid (se existir)    │              ┌────────┴────────┐              │   │
│  └─────────────────────────────────┘              │ SIM              │ NÃO          │   │
│                                                  │                  │              │   │
│                                                  ▼                  ▼              │   │
│                                    ┌────────────────────┐  ┌────────────────────┐   │   │
│                                    │ Criar contato      │  │ Criar contato      │   │   │
│                                    │ GRUPO              │  │ PENDENTE (LID)     │   │   │
│                                    │ isGroup = true     │  │ number =           │   │   │
│                                    │ name = nome grupo  │  │ "PENDING_<lid>"    │   │   │
│                                    │ remoteJid = jid    │  │ lidJid = lidJid    │   │   │
│                                    └────────────────────┘  │ status pendente    │   │   │
│                                                            └────────────────────┘   │   │
│           │                                                                            │   │
│           └────────────────── NÃO (só tem LID) ───────────────────────────────────────┤   │
│                                                                                      │   │
│                                                                                      │   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │   │
│  │ Criar contato PENDING (temporário)                                             │  │   │
│  │ number = "PENDING_123456789@lid"                                               │  │   │
│  │ lidJid = "123456789@lid"                                                       │  │   │
│  │ remoteJid = lidJid (fallback)                                                  │  │   │
│  │ Será reconciliado pelo job quando mapeamento LID→PN for descoberto             │  │   │
│  └────────────────────────────────────────────────────────────────────────────────┘  │   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE TICKET (após contato resolvido)                         │
│                                                                                          │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐    │
│   │  FindOrCreate │────▶│   Ticket      │────▶│   Mensagem    │────▶│   Socket.IO   │    │
│   │  TicketService│     │  (aberto ou   │     │   Criada no   │     │   Emite para  │    │
│   │               │     │   existente)  │     │   Banco       │     │   Frontend    │    │
│   └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    EVENTO: lid-mapping.update (Baileys v7)                                │
│                    Quando WhatsApp revela LID ↔ PN                                        │
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│   │  Baileys emite: { "123456789@lid": "5515999999999" }                              │    │
│   └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                               │
│                                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│   │  1. Salvar em LidMappings (verified=true)                                         │    │
│   │  2. Buscar Contatos PENDING_* ou com esse lidJid                                  │    │
│   │  3. SE existe contato real com esse PN → MERGE (mover tickets/mensagens)         │    │
│   │  4. SE NÃO existe → PROMOVER (atualizar PENDING_ para número real)               │    │
│   └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    JOB: ReconcilePendingContactsJob (a cada 60s)                        │
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│   │  Buscar: SELECT * FROM Contacts WHERE number LIKE 'PENDING_%'                   │    │
│   │  Para cada contato PENDING:                                                     │    │
│   │    ├── Consultar LidMapping pelo lidJid                                         │    │
│   │    ├── SE encontrado mapeamento → MERGE ou PROMOVER                             │    │
│   │    └── SE não encontrado → permanece PENDENTE (aguarda próximo ciclo)           │    │
│   └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘


## Resumo da Arquitetura em 3 Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                         MENSAGEM                                │
│                    (Baileys Event)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 1: EXTRAÇÃO                                             │
│  ├─ Extrai PN (número de telefone)                              │
│  ├─ Extrai LID (Linked Device ID)                             │
│  ├─ Extrai pushName (nome do contato)                         │
│  └─ Retorna: { pnJid, lidJid, pushName, canonicalNumber }     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 2: RESOLUÇÃO                                            │
│  ├─ Busca 1: Por canonicalNumber (telefone normalizado)         │
│  ├─ Busca 2: Por lidJid (coluna nova no Contact)                │
│  ├─ Busca 3: Por LidMapping (tabela de cache)                 │
│  └─ Retorna: Contact existente OU null                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │ ENCONTRADO              │ NÃO ENCONTRADO
                  ▼                         ▼
┌─────────────────────────┐    ┌─────────────────────────────────────┐
│ Retorna contato         │    │ CAMADA 3: CRIAÇÃO                 │
│ existente               │    │ ├─ Tem PN? → Contato normal       │
│                         │    │ ├─ É Grupo? → Contato de grupo      │
│                         │    │ └─ Só LID? → Contato PENDING_*      │
└─────────────────────────┘    └─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RECONCILIAÇÃO ASSÍNCRONA                     │
│  ├─ Evento lid-mapping.update → Atualiza em tempo real          │
│  ├─ Job a cada 60s → Reprocessa PENDING_* pendentes             │
│  └─ Resultado: PENDING_ vira número real ou é mesclado         │
└─────────────────────────────────────────────────────────────────┘
```


## Comparação: Antes vs Depois

### ANTES (Problemas)
```
getContactMessage() ──┐
                      ├──► spaghetti code ~800 linhas
verifyContact() ──────┘    ├── Race conditions
                           ├── Duplicados por LID
                           ├── Tickets em contatos errados
                           └── Lógica fragmentada
```

### DEPOIS (Arquitetura Limpa)
```
extractMessageIdentifiers() ──┐
                              ├──► 3 camadas separadas, ~250 linhas total
resolveContact() ──────────────┤    ├── Sem race conditions (transactions)
createContact() ──────────────┘    ├── PENDING_ para LIDs não resolvidos
                                     ├── Reconciliação assíncrona
                                     └── Lógica pura e testável
```


## Fluxo de Dados: JID → Contato → Ticket

```
Entrada (Baileys):
  remoteJid: "5515999999999@s.whatsapp.net"
  participant: "123456789@lid"  ← LID do remetente em grupo

Processamento:
  1. Extract: pnJid="5515999999999...", lidJid="123456789@lid"
  2. Resolve: Busca canonicalNumber="5515999999999" → Encontra contato #123
  3. Se não encontra: Busca lidJid="123456789@lid" → Encontra contato #456
  4. Se não encontra: Cria contato PENDING_123456789@lid

Saída (para Ticket):
  contact.id: 123
  contact.number: "5515999999999"
  contact.lidJid: "123456789@lid"  ← índice para futuras buscas
  contact.remoteJid: "5515999999999@s.whatsapp.net"
```
