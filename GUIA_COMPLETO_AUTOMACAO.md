# 🤖 GUIA COMPLETO - SISTEMA DE AUTOMAÇÃO

## 🎯 ARQUITETURA DO SISTEMA

Seu Whaticket possui **3 SISTEMAS DE AUTOMAÇÃO** diferentes que trabalham juntos:

### 1️⃣ **FlowBuilder** (Constructor Visual) 
- **Rota:** `/flowbuilders`
- **Função:** Criar fluxos de conversa visuais (arrastar e soltar)
- **Uso:** Boas-vindas, qualificação, funil de vendas
- **Modelo:** `FlowBuilders` table

### 2️⃣ **Chatbot** (Menu Hierárquico)
- **Rota:** `/queues` → Editar Fila → Aba "Opções"
- **Função:** Menu tradicional (Digite 1, 2, 3...)
- **Uso:** Direcionamento para filas/atendentes
- **Modelo:** `Chatbots` table (vinculado à Queue)

### 3️⃣ **Files + RAG** (Catálogo Inteligente)
- **Rota:** `/queues` → Editar Fila → Configurações Inteligentes
- **Função:** Sugestão automática de PDFs/arquivos baseado em palavras-chave
- **Uso:** Enviar catálogos, manuais, tabelas de preço automaticamente
- **Modelos:** `Files`, `FilesOptions`, `Queue.ragCollection`

---

## 📊 COMO FUNCIONAM JUNTOS

```
┌─────────────────────────────────────────────────────┐
│ CLIENTE ENVIA MENSAGEM                              │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ TEM FLOWBUILDER?   │ ← Configurado na CONEXÃO
         └─────────┬──────────┘
                   │
        ┌──────────▼────────┐
        │ SIM: Executa Fluxo│
        └──────────┬────────┘
                   │
         ┌─────────▼──────────┐
         │ Fluxo envia para   │
         │ FILA (Queue)       │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────────┐
         │ FILA TEM CHATBOT?      │ ← Menu 1, 2, 3
         └─────────┬──────────────┘
                   │
        ┌──────────▼────────────┐
        │ SIM: Menu de Opções   │
        │ NÃO: Vai para AGUARD. │
        └──────────┬────────────┘
                   │
         ┌─────────▼─────────────────┐
         │ FILA TEM RAG/CATÁLOGO?    │
         └─────────┬─────────────────┘
                   │
        ┌──────────▼───────────────┐
        │ SIM: Analisa mensagem e  │
        │ sugere arquivos (PDFs)   │
        └──────────┬───────────────┘
                   │
         ┌─────────▼──────────┐
         │ Envia automaticamente│
         │ conforme estratégia │
         └─────────────────────┘
```

---

## 🔧 CONFIGURAÇÃO PASSO A PASSO

### **PASSO 1: Criar FlowBuilder** (Fluxo de Boas-Vindas)

#### 1.1 - Acessar FlowBuilders:
```
Menu Lateral → Fluxos de Conversa (ícone de fluxograma)
```

#### 1.2 - Adicionar Novo Fluxo:
```
Botão: ADICIONAR FLUXO
Nome: "Boas-Vindas"
Status: Ativo ✅
```

#### 1.3 - Desenhar Fluxo Visual:
```
Nó 1 (Início):
  └─ Mensagem: "Olá! 👋 Bem-vindo à Nobre Luminárias!"
     └─ Botão: "Ver Catálogo" → Nó 2
     └─ Botão: "Falar com Vendedor" → Nó 3

Nó 2 (Catálogo):
  └─ Ação: Enviar para Fila "Início" (com RAG ativo)

Nó 3 (Vendedor):
  └─ Ação: Enviar para Fila "Vendas"
  └─ Mensagem: "Transferindo para um vendedor..."
```

#### 1.4 - Salvar Fluxo

---

### **PASSO 2: Criar Fluxo Padrão** (Mensagem Não Reconhecida)

#### 2.1 - Acessar Fluxos Padrão:
```
Configurações → Fluxos Padrão (FlowDefault)
```

#### 2.2 - Configurar:
```
Fluxo de Boas-Vindas: Selecionar "Boas-Vindas" (criado no Passo 1)
Fluxo Frase Não Reconhecida: Criar novo fluxo "Não Entendi"
  └─ Mensagem: "Desculpe, não entendi. Digite *menu* para ver opções."
```

---

### **PASSO 3: Vincular FlowBuilder à CONEXÃO**

#### 3.1 - Acessar Conexões:
```
Menu → Conexões → Editar sua conexão WhatsApp
```

#### 3.2 - Aba "Fluxo Padrão":
```
✅ Fluxo de Boas-Vindas: Selecionar "Boas-Vindas"
✅ Fluxo Frase Não Reconhecida: Selecionar "Não Entendi"
```

**IMPORTANTE:** A partir daqui, TODA mensagem nova vai passar pelo FlowBuilder!

---

### **PASSO 4: Configurar FILA com Chatbot (Opcional)**

Isso cria o menu tradicional "Digite 1, 2, 3..."

#### 4.1 - Acessar Filas:
```
Menu → Filas & Chatbot → Editar "Início"
```

#### 4.2 - Aba "Dados da Fila":
```
Nome: Início
Cor: #4895A3 (azul)
Mensagem de Saudação: "Olá! Escolha uma opção:"
```

#### 4.3 - Aba "Opções" → ADICIONAR OPÇÕES:

**Opção 1:**
```
ID: 1
Nome: Início
Cor: Azul
Ordem na fila (bot): 1
Mensagem de saudação: "Olá! Seja bem-vindo!"

Tipo de Fila:
  ☑️ Fila de Atendimento
  Qual opção de fila: Vendas (redireciona para fila "Vendas")
```

**Opção 2:**
```
ID: 2  
Nome: Atendimento
Cor: Rosa
Ordem na fila (bot): 1
Mensagem de saudação: "oi tente"

Tipo de Fila:
  ☑️ Fila de Atendimento
  Qual opção de fila: Atendimento
```

**Opção 3:**
```
ID: 3
Nome: Financeiro
Cor: Verde
Ordem na fila (bot): 1

Tipo de Fila:
  ☑️ Fila de Atendimento  
  Qual opção de fila: Financeiro
```

#### 4.4 - Resultado:
```
Cliente receberá:
"Olá! Escolha uma opção:
1️⃣ - Início
2️⃣ - Atendimento  
3️⃣ - Financeiro"

Ao digitar "1", vai para fila Vendas com mensagem "Olá! Seja bem-vindo!"
```

---

### **PASSO 5: Configurar RAG (Catálogo Inteligente)**

Aqui é onde a MÁGICA acontece! Sistema sugere arquivos automaticamente.

#### 5.1 - Criar Catálogo de Arquivos:
```
Menu → Chat Interno → Filas & Chatbot → Editar "Início"
```

#### 5.2 - Aba "Configurações Inteligentes de Arquivos":

**Rodízio:**
```
Ativar: ✅ SIM
Tempo de Roteador: 2 minutos
```

**Fechar Ticket:**
```
Fechar ticket ao finalizar chat (bot): ✅ SIM
```

**Estratégia de Envio:**
```
📋 Opções:
  - Nenhum: Não envia arquivos
  - Sob Demanda: Envia quando cliente pedir
  - Na Entrada: Envia assim que entrar na fila
  - Manual: Apenas atendente envia

✅ Escolher: "Sob Demanda" (envia quando cliente mencionar)
```

**Máximo de Arquivos por Sessão:**
```
3 arquivos (evita spam)
```

**Recuperando:**
```
"Qualquer arquivo por conversa"
(permite buscar em todo histórico)
```

**Template de Confirmação:**
```
Use [name], [filename], [description] para personalizar a mensagem

Exemplo:
"Olá [name]! 📄
Encontrei o arquivo [filename] que pode ajudar você.
Descrição: [description]

Deseja que eu envie?"
```

#### 5.3 - **Coleção RAG:**
```
Campo: "nobre_catalogos"

Esse é o nome da coleção onde os arquivos foram indexados.
Se vazio, usa busca simples por palavras-chave.
```

#### 5.4 - Criar Lista de Catálogos:

**IMPORTANTE:** Primeiro precisa criar os arquivos!

```
Menu → ??? (preciso verificar onde fica "Files")
```

Vou procurar a rota de Files/Catálogos...

---

## 🧪 TESTANDO O FLUXO COMPLETO

### Cenário 1: Cliente Novo (FlowBuilder Ativo)

```
1. Cliente: "Oi"
   Sistema: Executa FlowBuilder "Boas-Vindas"
   
2. Sistema: "Olá! 👋 Bem-vindo à Nobre Luminárias!
             [Ver Catálogo] [Falar com Vendedor]"

3. Cliente: Clica "Ver Catálogo"
   Sistema: Envia para fila "Início" (com RAG)
   
4. Sistema RAG: Analisa histórico da conversa
                Busca "catálogo" nos arquivos
                Encontra "Catálogo Premium.pdf"
                
5. Sistema: "Olá! 📄
             Encontrei o Catálogo Premium que pode ajudar você.
             Descrição: Catálogo completo de luminárias premium
             
             Deseja que eu envie?"
             
6. Cliente: "Sim"
   Sistema: Envia PDF automaticamente ✅
```

### Cenário 2: Cliente Antigo (Sem FlowBuilder, com Chatbot)

```
1. Cliente retorna após 24h
   Sistema: Pula FlowBuilder (já conhece)
   
2. Sistema: Verifica fila padrão "Início"
            Tem chatbot configurado?
            
3. Sistema: "Olá! Escolha uma opção:
             1️⃣ - Início
             2️⃣ - Atendimento
             3️⃣ - Financeiro"
             
4. Cliente: "1"
   Sistema: Redireciona para fila "Vendas"
            Mensagem: "Olá! Seja bem-vindo!"
            
5. Ticket fica em "AGUARDANDO" até atendente pegar
```

### Cenário 3: Cliente Pede Catálogo (RAG em Ação)

```
1. Cliente em conversa: "Quero ver o catálogo lite"
   
2. Sistema RAG:
   - Extrai palavras-chave: ["catálogo", "lite"]
   - Busca em Files onde keywords contém "lite"
   - Encontra: "Catálogo LITE.pdf" (score: 0.85)
   
3. Sistema: "Encontrei: Catálogo LITE
             Deseja que eu envie?"
             
4. Cliente: "sim"
   Sistema: Envia PDF ✅
```

---

## ⚙️ MODELOS DE BANCO DE DADOS

### **WhatsApp (Conexão)**
```sql
CREATE TABLE Whatsapps (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  status VARCHAR(50),
  
  -- FLOWBUILDER
  flowIdWelcome INT,          -- Fluxo de boas-vindas
  flowIdNotPhrase INT,        -- Fluxo quando não entende
  
  -- INTEGRAÇÃO
  integrationId INT,          -- QueueIntegration (Dialogflow, Typebot, etc)
  
  -- FILA PADRÃO
  sendIdQueue INT             -- Fila padrão para novos tickets
);
```

### **Queue (Fila)**
```sql
CREATE TABLE Queues (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  color VARCHAR(7),
  greetingMessage TEXT,
  
  -- CHATBOT (Menu)
  -- Opções ficam em tabela Chatbots com queueId
  
  -- RAG / ARQUIVOS
  fileListId INT,             -- Lista de arquivos disponíveis
  ragCollection VARCHAR(255),  -- Nome da coleção RAG
  
  -- ESTRATÉGIA DE ENVIO
  autoSendStrategy ENUM('none', 'on_enter', 'on_request', 'manual'),
  confirmationTemplate TEXT,
  maxFilesPerSession INT,
  
  -- INTEGRAÇÃO
  integrationId INT,          -- QueueIntegration específica da fila
  
  -- ROTEAMENTO
  ativarRoteador BOOLEAN,
  tempoRoteador INT,
  closeTicket BOOLEAN
);
```

### **Chatbot (Opções do Menu)**
```sql
CREATE TABLE Chatbots (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  greetingMessage TEXT,
  
  queueId INT,                -- Fila "pai" (onde o bot fica)
  chatbotId INT,              -- Opção "pai" (hierarquia)
  
  -- AÇÃO QUANDO ESCOLHER OPÇÃO
  queueType VARCHAR(50),      -- "queue", "integration", "agent", "file"
  optQueueId INT,             -- Redireciona para qual fila
  optUserId INT,              -- Redireciona para qual atendente
  optIntegrationId INT,       -- Chama qual integração (Dialogflow, etc)
  optFileId INT,              -- Envia qual arquivo
  
  isAgent BOOLEAN,
  closeTicket BOOLEAN
);
```

### **Files (Catálogo)**
```sql
CREATE TABLE Files (
  id INT PRIMARY KEY,
  companyId INT,
  name VARCHAR(255),
  message TEXT,               -- Mensagem ao enviar arquivo
  
  -- METADADOS
  isActive BOOLEAN,
  validFrom DATE,
  validUntil DATE,
  tags JSONB,                 -- ["premium", "residencial"]
  fileSlug VARCHAR(255)       -- URL ou caminho
);
```

### **FilesOptions (Itens do Catálogo)**
```sql
CREATE TABLE FilesOptions (
  id INT PRIMARY KEY,
  fileId INT,                 -- Qual catálogo pertence
  name VARCHAR(255),          -- Nome do item
  description TEXT,
  keywords TEXT,              -- "luminária, led, spot" (para RAG)
  path VARCHAR(255),          -- Caminho do arquivo PDF/imagem
  
  isActive BOOLEAN
);
```

### **FlowBuilder (Fluxo Visual)**
```sql
CREATE TABLE FlowBuilders (
  id INT PRIMARY KEY,
  user_id INT,
  company_id INT,
  name VARCHAR(255),
  active BOOLEAN,
  flow JSON                   -- Estrutura do fluxo visual
);
```

### **FlowDefault (Configuração Global)**
```sql
CREATE TABLE FlowDefaults (
  id INT PRIMARY KEY,
  companyId INT,
  userId INT,
  flowIdWelcome INT,          -- Qual FlowBuilder usar para boas-vindas
  flowIdNotPhrase INT         -- Qual FlowBuilder usar quando não entende
);
```

---

## 🔗 INTEGRAÇÕES DISPONÍVEIS

### **QueueIntegrations (type)**

#### 1. **dialogflow**
```json
{
  "type": "dialogflow",
  "projectName": "meu-projeto-123",
  "jsonContent": "{...credenciais...}",
  "language": "pt-BR"
}
```

#### 2. **typebot**
```json
{
  "type": "typebot",
  "urlN8N": "https://typebot.io/meu-bot",
  "typebotSlug": "atendimento-v1",
  "typebotExpires": 3600,
  "typebotKeywordFinish": "sair",
  "typebotKeywordRestart": "reiniciar",
  "typebotUnknownMessage": "Não entendi",
  "typebotRestartMessage": "Reiniciando...",
  "typebotDelayMessage": 1000
}
```

#### 3. **flowbuilder**
```json
{
  "type": "flowbuilder"
}
```
(Apenas marca que a fila usa FlowBuilder, configuração fica na conexão)

#### 4. **n8n**
```json
{
  "type": "n8n",
  "urlN8N": "https://n8n.example.com/webhook/whatsapp"
}
```

---

## 📁 ONDE ESTÃO AS ROTAS NO FRONTEND

```javascript
// Menu Lateral
/dashboard          → Dashboard
/painel             → Painel (alternativo)
/atendimentos       → Respostas rápidas
/contacts           → Contatos
/schedules          → Agendamentos
/tags               → Tags
/chatinterno        → Chat Interno
/ajuda              → Ajuda

// Administração
/envio-em-Massa     → Envio em Massa (Campanhas)
/flowbuilders       → 🔥 FLUXOS DE CONVERSA (FlowBuilder)
/flows-de-Campanha  → Fluxos de Campanha
/flows-de-Conversa  → Fluxos de Conversa (FlowDefault)
/informativos       → Informativos
/api                → API
/usuarios           → Usuários
/files-e-Chatbot    → 🔥 FILAS & CHATBOT (/queues)
/talk-ai            → Talk AI (IA)
/integracoes        → Integrações

// Conexões
/connections        → 🔥 CONEXÕES (WhatsApp)
```

---

## 🎯 RESUMO: ONDE CONFIGURAR CADA COISA

| O QUE | ONDE | ABA/CAMPO |
|-------|------|-----------|
| **Fluxo Visual** | /flowbuilders | Criar novo fluxo |
| **Vincular Fluxo à Conexão** | /connections → Editar | Aba "Fluxo Padrão" |
| **Menu 1,2,3 (Chatbot)** | /files-e-Chatbot → Editar Fila | Aba "Opções" |
| **RAG/Catálogo** | /files-e-Chatbot → Editar Fila | "Config. Inteligentes" |
| **Fila Padrão** | /connections → Editar | Aba "Geral" → "Redirecionamento" |
| **Campanhas** | /envio-em-Massa | Criar campanha |
| **Integração IA** | /talk-ai | Configurar LLM |

---

## ❓ PRÓXIMOS PASSOS PARA VOCÊ

1. **Acessar `/flowbuilders`** e criar fluxo "Boas-Vindas"
2. **Acessar `/connections`** e vincular fluxo à sua conexão
3. **Acessar `/files-e-Chatbot`** e configurar:
   - Opções de menu (se quiser 1, 2, 3)
   - RAG Collection (se tiver arquivos)
   - Estratégia de envio
4. **Testar** com número novo

---

## 🆘 PRECISA DE AJUDA?

Me envie:
1. **Print da tela** `/flowbuilders` mostrando seus fluxos
2. **Print** da configuração da fila "Início" (todas as abas)
3. **Print** da aba "Fluxo Padrão" na edição da conexão

Assim consigo te guiar EXATAMENTE onde configurar! 🚀
