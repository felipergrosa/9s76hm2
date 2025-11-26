# Guia Rápido do RAG Integrado ao Bot

Este guia resume o que foi implementado no backend para o sistema de **RAG (Retrieval-Augmented Generation)** integrado ao bot de WhatsApp.

Foco:
- Como o bot usa a RAG (texto e áudio)
- Como funcionam **coleções por fila** (`Queue.ragCollection`)
- Como indexar materiais (catálogos, PDFs, imagens, vídeos, áudios)
- Como indexar conversas históricas
- Scripts auxiliares criados

---

## 1. Integração do RAG com o Bot

### 1.1. Fluxo de texto (`handleOpenAi`)

Arquivo principal: `backend/src/services/IntegrationsServices/OpenAiService.ts`

Para mensagens de texto:

1. O bot:
   - Lê a mensagem atual (`bodyMessage`).
   - Busca o histórico de mensagens do ticket (`Message.findAll`).
   - Monta um `promptSystem` com:
     - Regras de atendimento
     - Dados do CRM do contato (nome fantasia, cidade, segmento, situação, etc.)
     - Prompt específico da fila (campo `prompt` do `Prompt` associado à fila).

2. Antes de chamar a IA, o código resolve a configuração de RAG para o ticket:

   - Função helper: `resolveRAGConfigForTicket(ticket)`
   - Essa função:
     - Lê `Queue.ragCollection` da fila atual.
     - Monta uma lista de tags de filtro, ex.: `collection:produtos_vendas`.
     - Lê as configurações da integração `knowledge` (quando existir):
       - `ragEnabled`, `ragTopK`.
     - Faz fallback em `CompaniesSettings` (`ragEnabled`, `ragTopK`) se necessário.

3. Se o RAG estiver habilitado (`enabled = true`) e houver mensagem:

   - Chama `ragSearch` (`RAGSearchService.search`) com:
     - `companyId`: empresa do ticket
     - `query`: texto da última mensagem do cliente
     - `k`: top K definido (padrão ~4)
     - `tags`: ex.: `['collection:produtos_vendas']`

   - A busca retorna os trechos mais relevantes da base de conhecimento.
   - Esses trechos são anexados ao `promptSystem` em um bloco:

     > Use, se relevante, as fontes a seguir (não invente fatos):
     > Fonte 1: ...
     > Fonte 2: ...

4. Por fim, o bot chama a IA (OpenAI ou Gemini) com:
   - `system`: `promptSystem` (agora enriquecido com RAG)
   - `history`: histórico de conversa
   - `user`: mensagem atual do cliente.

### 1.2. Fluxo de áudio

Ainda em `handleOpenAi`:

1. Se chegar mensagem de áudio:
   - O arquivo é baixado para `public/company<id>/...`.
   - A IA faz a **transcrição**:
     - Preferencialmente via `IAClientFactory.transcribe` (OpenAI Whisper ou Gemini).
     - Fallback para a chamada direta da API (`openai.audio.transcriptions.create` ou Gemini).

2. A transcrição é enviada ao cliente como texto:

   ```text
   🎤 *Sua mensagem de voz:* <transcrição>
   ```

3. A transcrição entra no histórico como mensagem do usuário (`messagesAI.push({ role: "user", content: transcription })`).

4. **Novo**: a transcrição também é usada como `ragQuery`:

   - O código chama `resolveRAGConfigForTicket(ticket)`.
   - Se o RAG estiver habilitado, chama `ragSearch` com:
     - `query`: transcrição do áudio
     - `tags`: incluindo `collection:<ragCollection-da-fila>`.
   - Se houver resultados, o contexto da RAG é anexado ao `promptSystem` **antes** de chamar a IA para responder o áudio.

Resultado: **tanto texto quanto áudio** passam a usar a base de conhecimento RAG filtrada pela coleção da fila.

---

## 2. Coleções por Fila (`Queue.ragCollection`)

### 2.1. Conceito

Cada fila (`Queue`) pode ter um campo `ragCollection` indicando a coleção de conhecimento associada.

Exemplos de coleções:
- `produtos_vendas`
- `suporte_tecnico`
- `financeiro`
- `atendimento_geral`

Quando o bot atende na fila X:
- O RAG só consulta documentos **tagueados** com `collection:<ragCollection-da-fila>`.

### 2.2. Como o filtro é aplicado

1. Em `resolveRAGConfigForTicket(ticket)`:
   - Lê-se `Queue.ragCollection`.
   - Se houver valor, a tag `collection:<valor>` entra na lista de tags de filtro.

2. Nas chamadas a `ragSearch`:

   ```ts
   const hits = await ragSearch({
     companyId: ticket.companyId,
     query: bodyMessageOuTranscricao,
     k: ragCfg.k,
     tags: ragCfg.tags // ex.: ['collection:produtos_vendas']
   });
   ```

3. No banco, os documentos/chunks têm um campo `tags` (TEXT com JSON string) que inclui:
   - `collection:<nome>` quando indexados nessa coleção.

---

## 3. Como os Documentos são Indexados com Coleção

### 3.1. Endpoint de texto (`/helps/rag/index-text`)

Controller: `RAGController.indexText`

- Request body aceita:
  - `title`, `text`, `tags`, `chunkSize`, `overlap`
  - **Novo**: `collection` ou `ragCollection`

- Se `collection/ragCollection` vier preenchido:
  - O controller adiciona `collection:<nome>` em `tags`.
  - O serviço `RAGIndexService.indexTextDocument` salva isso em `KnowledgeDocuments.tags` e `KnowledgeChunks.tags`.

### 3.2. Endpoint de arquivo (`/helps/rag/index-file`)

Controller: `RAGController.indexFile`

- Request body aceita:
  - `fileOptionId`, `title`, `tags`, `chunkSize`, `overlap`
  - **Novo**: `collection` ou `ragCollection`

- Idem: o controller adiciona `collection:<nome>` nas tags antes de chamar `indexFileAuto`.

### 3.3. Auto-index de conversas

Serviço: `AutoIndexService`

- Quando indexa conversas históricas de tickets, o método `generateConversationTags` gera tags como:
  - `conversation`, `historical`, `status:<status>`, `ticket:<id>`, `queue:<nome>`.
  - **Novo**: se a fila tiver `ragCollection`, é adicionada a tag `collection:<ragCollection-da-fila>`.

Assim, conversas passadas ficam filtráveis por coleção, e o bot só usa exemplos históricos da fila correta.

---

## 4. Scripts Auxiliares Criados

### 4.1. `setup-rag-collections.ts`

Caminho: `backend/src/scripts/setup-rag-collections.ts`

Função:
- Listar todas as filas e mostrar o estado atual de `ragCollection`.
- Aplicar algumas coleções sugeridas com base no nome da fila (Vendas, Suporte, Financeiro, Atendimento, etc.).

Uso:

```bash
cd backend
npx ts-node src/scripts/setup-rag-collections.ts [companyId]
```

- Se `companyId` for informado, filtra pelas filas dessa empresa.
- Caso contrário, considera todas.

### 4.2. `bulk-index-rag.ts`

Caminho: `backend/src/scripts/bulk-index-rag.ts`

Função:
- Percorrer arquivos do FileManager (`FilesOptions` + `Files`) e indexar automaticamente no RAG, usando `indexFileAuto`.
- Taguear os documentos com a coleção desejada e algumas tags auxiliares.

Uso:

```bash
cd backend
npx ts-node src/scripts/bulk-index-rag.ts <companyId> <collection> [extensions]
```

Exemplos:

```bash
# Indexar apenas PDFs na coleção de produtos_vendas
npx ts-node src/scripts/bulk-index-rag.ts 1 produtos_vendas .pdf

# Indexar PDFs + imagens
npx ts-node src/scripts/bulk-index-rag.ts 1 produtos_vendas .pdf,.jpg,.png
```

### 4.3. `auto-index-conversations.ts`

Caminho: `backend/src/scripts/auto-index-conversations.ts`

Função:
- Rodar o `AutoIndexService` para indexar conversas históricas (tickets) em lote.
- Usa as tags e coleções da fila para marcar os documentos de conversa.

Uso:

```bash
cd backend
npx ts-node src/scripts/auto-index-conversations.ts <companyId> [days]
```

Exemplo:

```bash
# Indexar conversas dos últimos 30 dias
npx ts-node src/scripts/auto-index-conversations.ts 1 30
```

---

## 5. Check-list para Colocar em Produção

1. **Banco e migrations**
   - pgvector instalado.
   - Migrations da RAG aplicadas (`KnowledgeDocuments`, `KnowledgeChunks`, campos de RAG em `CompaniesSettings`).

2. **Integrações de IA**
   - Integração OpenAI/Gemini configurada para filas que usam bot.
   - Integração `knowledge` opcional para controlar `ragEnabled`/`ragTopK`.

3. **Coleções por fila**
   - Rodar `setup-rag-collections.ts` ou configurar manualmente `Queue.ragCollection`.

4. **Indexação de materiais**
   - Subir arquivos no FileManager.
   - Rodar `bulk-index-rag.ts` por coleção (produtos, suporte, financeiro, etc.).

5. **Indexação de conversas**
   - Rodar `auto-index-conversations.ts` para alimentar a base com históricos de tickets.

6. **Teste do bot**
   - Fazer perguntas específicas em filas diferentes.
   - Ver logs com `[IA][rag][retrieve][wbot]` e `[audio]`.
   - Ajustar `ragTopK` e coleções conforme necessário.

---

## 6. Onde Ajustar Comportamento Fino

- **Prompt por fila** (voz, tom, regras de negócio):
  - Modelo `Prompt` associado a cada fila.
  - Campo `prompt` é usado no `OpenAiService` dentro do `promptSystem`.

- **Parâmetros de RAG**:
  - Integração `knowledge` (JSON): `ragEnabled`, `ragTopK`, `ragEmbeddingModel`.
  - `CompaniesSettings`: colunas `ragEnabled`, `ragTopK` como fallback.

- **Fontes da base**:
  - Endpoints `/helps/rag/index-text`, `/helps/rag/index-file`, `/helps/rag/index-url`, `/helps/rag/index-sitemap`.

Com isso, o bot passa a usar:
- Catálogos
- Tabelas de preços
- Imagens, vídeos, áudios (via OCR/transcrição)
- Conversas históricas
- Dados do CRM

Tudo organizado por **coleções de fila**, para que cada fila tenha seu próprio “cérebro” de conhecimento.
