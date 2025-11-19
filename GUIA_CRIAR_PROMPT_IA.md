# 🤖 GUIA: Criar Prompt de IA (Passo a Passo)

## 📋 PRÉ-REQUISITOS

Antes de criar um Prompt, você precisa ter:

✅ **OpenAI Configurado** (`/ai-settings` → OPENAI Habilitado)
✅ **Pelo menos 1 Fila criada** (`/queues`)

---

## 🎯 MÉTODO 1: Criar do Zero

### **Passo 1: Acessar Prompts**
```
Menu → Prompts → ADICIONAR PROMPT
```

### **Passo 2: Preencher Campos Obrigatórios**

#### 2.1 - **Nome** ⭐ OBRIGATÓRIO
```
Exemplo: "Atendente Virtual Nobre"
Mínimo: 5 caracteres
```

#### 2.2 - **Integração IA** ⭐ OBRIGATÓRIO
```
Dropdown: Selecionar "OPENAI"

Se não aparecer nenhuma opção:
1. Ir em /ai-settings
2. Aba PROVEDORES
3. Habilitar OPENAI
4. Voltar e tentar novamente
```

#### 2.3 - **Prompt** ⭐ OBRIGATÓRIO
```
Mínimo: 50 caracteres

Exemplo básico:
────────────────────────────────────
Você é um assistente virtual da Nobre Luminárias.

Atenda clientes com cordialidade e ajude com:
- Dúvidas sobre produtos
- Envio de catálogos
- Informações sobre preços

Sempre seja educado e use emojis moderadamente 😊
────────────────────────────────────
```

#### 2.4 - **Filas** ⭐ OBRIGATÓRIO
```
Dropdown: Selecionar "Início" (ou outra fila)

⚠️ Este prompt será usado apenas quando
   o ticket estiver na fila selecionada!
```

### **Passo 3: Configurar Voz e Transcrição**

```
Voz: Texto (padrão)
Temperature: 0.9 (criatividade)
```

### **Passo 4: Clicar ADICIONAR**

✅ **Pronto!** Prompt criado com sucesso!

---

## 🎨 MÉTODO 2: Usar Template (RECOMENDADO)

### **Passo 1: Acessar Templates**
```
Menu → Prompts → MELHORIAS (botão vermelho no topo)
```

### **Passo 2: Escolher Template**

Aparecem 8 templates prontos:

| Template | Categoria | Dificuldade | Score |
|----------|-----------|-------------|-------|
| **Atendimento E-commerce** | Vendas | Fácil | ⭐ 9.5 |
| **Especialista em Suporte Avançado** | Suporte | Avançado | ⭐ 9.2 |
| **Vendas B2B Corporativas** | Vendas | Avançado | ⭐ 9.9 |
| **Agendamentos Inteligentes** | Atendimento | Fácil | ⭐ 8.9 |
| **Cobrança Humanizada** | Financeiro | Médio | ⭐ 8.2 |
| **Onboarding de Clientes** | Sucesso do Cliente | Médio | ⭐ 9.1 |

### **Passo 3: Clicar no Template**

```
Exemplo: "Especialista em Suporte Avançado"

Mostra:
✅ Prompt completo (500+ palavras)
✅ Variáveis disponíveis: {nome}, {email}, etc
✅ Voz sugerida: pt-BR-FranciscaNeural
✅ RAG sugerido: Habilitado
✅ Temperature: 0.7
✅ Max Tokens: 3000
```

### **Passo 4: Clicar "USAR TEMPLATE"**

Modal abre com dados pré-preenchidos:
```
✅ Nome: "Especialista em Suporte Avançado"
✅ Prompt: [500+ palavras já escritas]
✅ Voz: pt-BR-FranciscaNeural
✅ Temperature: 0.7
```

### **Passo 5: Completar Campos Obrigatórios**

⚠️ **VOCÊ AINDA PRECISA SELECIONAR:**

```
Integração IA: Selecionar "OPENAI"
Filas: Selecionar "Início"
```

### **Passo 6: Personalizar (Opcional)**

```
Ajustar o texto do prompt:
- Trocar "sua empresa" por "Nobre Luminárias"
- Adicionar produtos específicos
- Adicionar informações de contato
```

### **Passo 7: Clicar ADICIONAR**

✅ **Pronto!** Template aplicado e salvo!

---

## 🎯 EXEMPLO COMPLETO: Atendente Virtual Nobre

### **Configuração:**

```
Nome: Atendente Virtual Nobre

Integração IA: OPENAI

Filas: Início

Prompt:
────────────────────────────────────────────────────────────
Você é um assistente virtual especializado da Nobre Luminárias.

# SEU PAPEL
- Atender clientes com cordialidade e profissionalismo
- Responder dúvidas sobre produtos, preços, prazos e entrega
- Enviar catálogos quando solicitado
- Qualificar o cliente antes de passar para humano

# BASE DE CONHECIMENTO
Você tem acesso a:
- Catálogos em PDF (LITE e Premium)
- Histórico de conversas anteriores
- Site: nobreluminarias.com.br

# QUANDO TRANSFERIR PARA HUMANO
1. Cliente quer negociar preço específico
2. Cliente quer fazer pedido/orçamento
3. Cliente tem dúvida técnica muito específica
4. Cliente solicita falar com vendedor

# NUNCA FAÇA
- Invente informações que não estão na base
- Dê descontos sem autorização
- Confirme estoque sem consultar
- Feche vendas sozinho

# SEMPRE FAÇA
- Seja cordial e use emojis moderadamente 😊
- Pergunte o nome do cliente
- Ofereça catálogos quando relevante
- Resuma o que o cliente precisa antes de transferir

# VARIÁVEIS DISPONÍVEIS
{{nome}} = Nome do contato
{{firstName}} = Primeiro nome
{{empresa}} = Nobre Luminárias
{{saudacao}} = Bom dia/Boa tarde/Boa noite

# EXEMPLOS DE CONVERSAS

Cliente: "Quero ver o catálogo"
Você: "Claro, {{firstName}}! Temos 2 catálogos:
📄 Catálogo LITE (produtos básicos)
📄 Catálogo Premium (linha completa)
Qual você gostaria?"

Cliente: "Quanto custa a luminária X?"
Você: "Deixa eu verificar no catálogo... [consulta RAG]
A luminária X custa R$ XXX segundo nosso catálogo Premium.
Gostaria de mais detalhes ou fazer um orçamento?"

Cliente: "Quero fazer um pedido"
Você: "Perfeito! Vou conectar você com um vendedor.
Resumindo: [resumo do que cliente precisa]
Aguarde um momento... 🔄"
[TRANSFERIR PARA FILA VENDAS]

# TOM E ESTILO
- Profissional mas cordial
- Use emojis: 😊 📄 ✅ 🔄 💡 (máximo 2 por mensagem)
- Mensagens curtas (máximo 3 linhas)
- Pergunte sempre se pode ajudar em mais alguma coisa
────────────────────────────────────────────────────────────

Voz: Texto
Temperature: 0.8
Max Tokens: 3000
```

### **Resultado:**

```
✅ Prompt salvo com sucesso!
✅ Será usado apenas em tickets da fila "Início"
✅ IA responderá automaticamente usando o RAG
```

---

## ❌ ERROS COMUNS

### **Erro 1: "Botão ADICIONAR não faz nada"**

**Causa:** Campos obrigatórios não preenchidos

**Solução:**
```
1. Verificar se todos os campos com ⭐ estão preenchidos:
   - Nome (mín 5 caracteres)
   - Prompt (mín 50 caracteres)
   - Integração IA (selecionar OPENAI)
   - Filas (selecionar uma fila)

2. Olhar mensagens de erro em vermelho abaixo dos campos
```

### **Erro 2: "USAR TEMPLATE dá erro"**

**Causa:** Template não preenche Integração IA e Fila automaticamente

**Solução:**
```
1. Depois de clicar "USAR TEMPLATE"
2. Selecionar manualmente:
   - Integração IA: OPENAI
   - Filas: Início (ou outra)
3. Clicar ADICIONAR
```

### **Erro 3: "Integração IA não aparece no dropdown"**

**Causa:** OpenAI não está habilitado

**Solução:**
```
1. Ir em /ai-settings
2. Aba PROVEDORES
3. Clicar em OPENAI
4. Habilitar e configurar API Key
5. Salvar
6. Voltar para /prompts e tentar novamente
```

### **Erro 4: "IA não responde nos tickets"**

**Causa:** Prompt não está vinculado corretamente à fila

**Solução:**
```
1. Verificar se ticket está na fila correta (ex: "Início")
2. Verificar se prompt foi criado para essa fila
3. Verificar se RAG está habilitado em /ai-settings
4. Verificar se OpenAI tem créditos suficientes
```

---

## 🧪 TESTANDO O PROMPT

### **Teste 1: Verificar se Prompt Está Ativo**

```
1. Ir em /prompts
2. Ver lista de prompts criados
3. Verificar coluna "Fila" → deve mostrar "Início"
4. Verificar coluna "Máximo de Tokens" → deve mostrar valor configurado
```

### **Teste 2: Enviar Mensagem de Teste**

```
1. Criar ticket de teste na fila "Início"
2. Enviar mensagem: "Olá"
3. Aguardar resposta da IA (5-10 segundos)
4. ✅ IA deve responder conforme o prompt
```

### **Teste 3: Testar RAG (Catálogos)**

```
1. Em um ticket, digitar: "Quero ver o catálogo"
2. ✅ IA deve sugerir enviar PDF
3. Cliente: "Sim"
4. ✅ Sistema deve enviar arquivo automaticamente
```

---

## 🎯 DICAS E BOAS PRÁTICAS

### **1. Prompt Eficiente**

```
✅ BOM:
"Você é um atendente da Nobre Luminárias.
Ajude com dúvidas sobre produtos e preços.
Seja cordial e use {{nome}} do cliente."

❌ RUIM:
"Atenda bem"
(muito curto, sem instruções claras)
```

### **2. Use Variáveis Mustache**

```
{{nome}} → Nome completo do contato
{{firstName}} → Primeiro nome
{{saudacao}} → Bom dia/Boa tarde/Boa noite
{{empresa}} → Nobre Luminárias
{{data}} → Data atual (DD-MM-YYYY)
{{hora}} → Hora atual (HH:MM:SS)
```

### **3. Temperature Ideal**

```
0.5 - 0.7: Respostas consistentes e previsíveis (RECOMENDADO)
0.8 - 1.0: Respostas criativas (cuidado, pode inventar)
1.5 - 2.0: Muito criativo (NÃO RECOMENDADO para atendimento)
```

### **4. Max Tokens Ideal**

```
300-500: Respostas curtas (chat rápido)
1000-2000: Respostas médias (explicações)
3000-4000: Respostas longas (suporte técnico)
```

### **5. Estrutura de Prompt Ideal**

```
1. PAPEL (Quem é a IA)
2. OBJETIVO (O que deve fazer)
3. REGRAS (O que NUNCA fazer)
4. EXEMPLOS (Como responder)
5. TOM (Como se comunicar)
```

---

## 📊 MONITORAMENTO

### **Verificar Uso da IA**

```
1. Ir em /ai-settings
2. Aba ANALYTICS
3. Ver métricas:
   - Taxa de resolução pela IA
   - Tempo médio de resposta
   - Satisfação do cliente
   - Principais tópicos consultados
```

### **Ajustar Prompt Conforme Feedback**

```
1. Ler conversas onde IA atendeu
2. Identificar erros ou respostas ruins
3. Editar prompt em /prompts
4. Adicionar exemplos específicos
5. Testar novamente
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ **Criar primeiro prompt** usando template "Especialista em Suporte"
2. ✅ **Testar** com mensagens reais
3. ✅ **Ajustar** conforme necessário
4. ✅ **Monitorar** métricas em Analytics
5. ✅ **Criar prompts específicos** para cada fila (Vendas, Suporte, Financeiro)

---

**PROBLEMAS?**

Se continuar com erro ao salvar, me envie:
1. Print do modal com todos os campos preenchidos
2. Print do console do navegador (F12)
3. Mensagem de erro exata

Vou te ajudar! 🚀
