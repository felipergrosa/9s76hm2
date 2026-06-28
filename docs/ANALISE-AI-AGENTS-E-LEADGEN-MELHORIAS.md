# Análise: AI Agents avançados + captura de leads (estilo ManyChat) + web scraping para CRM

> Investigação de viabilidade, sem limite de estrelas (critério aqui foi maturidade/profundidade técnica, não popularidade) — complementar aos outros 3 docs de análise em `docs/`.

## 1. Resumo executivo

Três frentes pedidas: (1) projetos com lógica de **AI Agent** bem desenvolvida, pra melhorar o que o Whaticket já tem; (2) algo tipo **ManyChat** (automação de canal social pra captura de lead); (3) **web scraping** para alimentar um CRM completo.

Achado central da frente 1: o `AIAgent`/`FunnelStage` do Whaticket hoje guarda tudo como colunas de banco e texto livre interpretado por LLM (`autoAdvanceCondition`, `enabledFunctions: string[]`). Três projetos diferentes (Mastra, LangGraph, Letta) — sem terem se falado entre si — convergem na mesma direção: **estruturar isso como schema tipado + estado persistido com histórico**, em vez de string livre. Quando fontes independentes convergem na mesma recomendação, é sinal forte de que é o ajuste certo.

Achado central da frente 3 (scraping): a parte mais importante não é uma feature, é um **alerta de risco real** — scraping de Instagram/Facebook/LinkedIn para captura de lead viola Termos de Serviço dessas plataformas e pode levar ao banimento da própria conta usada pra WhatsApp Business (mesmo ecossistema Meta). Isso precisa pesar mais que qualquer ganho de funcionalidade.

## 2. AI Agents — o que estudar para melhorar o que já existe

### 2.1 Dify (~138k stars, Apache 2.0 modificado) — RAG, tools e versionamento de prompt

- **RAG mais sofisticado que KnowledgeChunk simples**: chunking "Parent-Child" (busca em trecho pequeno e preciso, mas devolve o contexto do documento-pai inteiro pra geração) e reranking como etapa **separada e plugável** do retrieval — hoje provavelmente o Whaticket faz busca e geração acopladas. Vale considerar separar essas duas etapas no pipeline de RAG existente, sem trocar de banco vetorial.
- **Tool = contrato declarativo** (schema de parâmetros tipados + descrição em linguagem natural), desacoplado da estratégia de raciocínio (ReAct vs. function-calling). Hoje `enabledFunctions: string[]` no `FunnelStage` é uma lista de nomes soltos, sem schema. Formalizar cada função do agente com um schema de parâmetros validável é uma melhoria direta e de baixo risco — não muda comportamento de quem já usa, só formaliza o que já existe.
- **Draft vs. Published com snapshot por conversa**: editar o agente sempre afeta um "draft"; publicar cria versão imutável; **uma conversa em andamento fica amarrada à versão que estava publicada quando ela começou** (não pula pra versão nova no meio). Isso é o mesmo padrão já aprovado pro versionamento do FlowBuilder (Fase 5 do plano em andamento) — vale aplicar o mesmo conceito ao `AIAgent`/`FunnelStage` quando chegar a vez, reaproveitando o desenho já decidido, não inventando um segundo.
- Licença permite estudar/aplicar os padrões livremente — só restringe rodar o código-fonte deles como SaaS multi-tenant sem licença, irrelevante aqui.

### 2.2 Mastra (~22k stars, Apache 2.0, **TypeScript** — mesma linguagem do backend) — padrões de código diretamente portáveis

Como é TS, a barreira de portar *padrões de código* (não a lib inteira) é menor que nos outros.

- **Separar responsabilidades hoje misturadas em uma tabela**: o `AIAgent.ts` tem ~50 colunas misturando definição do agente, ferramentas, memória e regras de SDR. O padrão do Mastra (`Agent` com `instructions`/`model` resolvidos por função em runtime, `tools` tipados com Zod, `workflows` como objeto separado) sugere, como evolução futura (não urgente, não quebra nada hoje): separar conceitualmente "definição do agente" de "conjunto de tools" de "config de memória" de "funil" — pode ser feito gradualmente, mantendo a tabela atual e só organizando os campos novos dentro dessa lógica.
- **Suspend/resume tipado — a ideia mais valiosa e de baixo risco**: salvar um snapshot estruturado (`suspendSchema`/`resumeSchema`) quando o agente pausa esperando decisão humana (ex.: aprovação de desconto, confirmação de agendamento), e retomar exatamente daquele ponto quando o atendente responder — em vez de só "transferir fila e o bot para de responder". Isso fortalece o handoff SDR→closer que já existe (`sdrTransferTriggers`) sem trocar a lógica de negócio, só estruturando melhor a pausa/retomada.
- **Memória escopada por `resource` (≈ contato) em vez de só por `thread` (≈ ticket)**: dois tickets diferentes do mesmo contato hoje provavelmente não compartilham contexto. Resolver isso é exatamente o mesmo problema que o Letta também aponta (§2.3) — convergência entre duas fontes independentes.
- Opinião do levantamento, que adoto: **não vale adotar o Mastra como motor** (re-arquitetura grande, dependência externa de projeto que ainda muda rápido, ganho menor que o risco) — vale só copiar os padrões de schema/separação, mantendo a implementação 100% própria em Sequelize.

### 2.3 Letta/MemGPT (Apache 2.0) — a lacuna real: memória entre tickets diferentes do mesmo contato

Achado mais concreto e de menor risco de toda a frente de AI Agents: hoje, se um contato abre um novo ticket dias depois, o agente provavelmente não "lembra" de nada do atendimento anterior (só o histórico de mensagens *daquele* ticket).

**Recomendação de menor risco (não adotar o framework Letta, só o conceito):**
- Campo novo `Contact.aiMemory` (texto curto, ~1-2KB, sobrescrita, não tabela de histórico ilimitado) ou tabela `ContactMemory` separada.
- Uma tool nova exposta ao AI Agent, tipo `salvar_memoria_contato(resumo)`, que o próprio LLM chama quando identifica um fato relevante e duradouro (preferência, queixa recorrente, dado já informado) — sem pipeline externo decidindo por ele.
- Esse campo é injetado no system prompt de **qualquer** ticket novo daquele contato, antes do histórico da conversa atual.
- Aditivo puro: não toca no RAG existente (`KnowledgeChunk`), não muda nenhum ticket já em andamento, só adiciona contexto a partir de quando for implementado.

Não recomendo rodar o servidor Letta (Python/FastAPI) via HTTP — ainda que tecnicamente viável (tem SDK TypeScript oficial), é overhead de infraestrutura desproporcional a um problema que se resolve com um campo e uma tool function.

### 2.4 LangGraph (Python, mas conceito é o que importa) — formalizar o funil como máquina de estados de verdade

Hoje `autoAdvanceCondition` é texto livre interpretado por LLM — sem garantia de que o LLM retorne algo válido. O padrão LangGraph sugere uma estrutura concreta:

```
FunnelStage.stageKey (string estável, não só order/name)
FunnelStage.transitions: [{ toStageKey, condition: { type: "sentiment_gte" | "keyword_match" | "field_collected" | "llm_classify", params }, priority }]
```

Com `llm_classify` mantido como fallback (mas obrigando o LLM a retornar um `stageKey` de um enum fechado, não texto livre). E, em paralelo, persistir histórico do funil por ticket:

```
TicketFunnelState: { currentStageKey, stageHistory: [{ stageKey, enteredAt, exitReason, snapshotData }], pausedForHuman: { reason, askedAt, resumeStageKey } }
```

Isso dá **audit trail** (por que o agente avançou pra esse estágio) e formaliza o "pausado esperando humano" como estado persistido, em vez de inferido. É uma mudança de schema aditiva — `FunnelStage`/`AIAgent` atuais continuam funcionando; os campos novos só passam a ter dado quando o funil for editado de novo.

## 3. Estilo ManyChat — automação de canal social para captura de lead

Pedido: algo tipo ManyChat (broadcast, sequences, automação por canal social). Avaliei 2 clones recentes (ChatbotX, ZernFlow) e o Typebot (que o Whaticket **já integra parcialmente** via `FlowBuilderAddTypebotModal`).

### 3.1 Aviso de maturidade — sendo honesto sobre o que são essas referências
ChatbotX (~295 stars, AGPLv3) e ZernFlow (~70 stars, MIT) são projetos **recentes e pequenos** — não têm histórico de produção em escala. ZernFlow em particular terceiriza pra um SaaS proprietário externo ("Zernio API") justamente a parte mais difícil (OAuth, rate-limiting, mensageria multicanal) — ou seja, a arquitetura que importaria copiar não está no código aberto dele. Tratar os dois como **checklist de features a considerar**, não como referência de arquitetura testada em produção.

### 3.2 Features concretas, por ordem de risco/esforço

1. **Broadcast segmentado por Tag** (baixo risco, alto valor) — o Whaticket já tem Tags; falta só UI de seleção de segmento + job de disparo em lote com rate-limit, reaproveitando a fila (Bull) que já existe. Não precisa de nenhum dos projetos pesquisados como dependência, só a ideia.
2. **Sequences/drip simples** (baixo-médio risco) — anexar "delay + próxima mensagem" como um novo tipo de nó no FlowBuilder já existente (reactflow), usando a fila já existente pra agendar o próximo envio. Aditivo ao FlowBuilder, não exige novo subsistema.
3. **Comment-to-DM no Instagram** (maior esforço, mas legítimo e documentado pela própria Meta) — usa o endpoint oficial de **Private Reply** da Graph API (responder via DM a quem comenta um post, dentro da janela de 24h, limite de ~200 DMs automáticas/hora). Tecnicamente é um canal Meta novo (Instagram comments), não uma extensão do webhook do WhatsApp — encaixa como trabalho complementar à Fase 7 já aprovada (conexão Meta via OAuth), não a substitui.

### 3.3 Typebot — formalizar o que já existe, não adotar algo novo
O Whaticket já referencia o Typebot no FlowBuilder (`FlowBuilderAddTypebotModal`). O Typebot tem captura tipada e validada (bloco de Email com validação de formato, Telefone com normalização, Date, Number) — mais maduro que pergunta de texto livre. O webhook de saída do Typebot manda um JSON já mapeado pelas variáveis do bot.

**Recomendação direta e de baixo risco**: criar um endpoint dedicado (`POST /typebot/lead-completed` ou similar) que recebe esse JSON e cria automaticamente `Contact` + `ContactCustomField` **tipados** — conectando diretamente com a tipagem de `ContactCustomField` já planejada (Fase 2 do plano de implementação em andamento, vindo da análise do Twenty). Fecha um ciclo que já existe pela metade: hoje o Typebot provavelmente só conversa dentro do fluxo; formalizar a saída dele como criação automática de lead estruturado é o que falta.

Licença do Typebot: FSL-1.1 (converte para Apache 2.0 após 2 anos por release) — proíbe oferecer um produto concorrente do Typebot, mas **permite uso interno/embutido**, que é exatamente o caso do Whaticket.

## 4. Web scraping para captura de leads — ressalva antes de qualquer recomendação

**Isto é mais importante que as features abaixo**: scraping direto de Instagram, Facebook ou LinkedIn para captura de leads **viola os Termos de Serviço** dessas plataformas. LinkedIn proíbe formalmente bots/crawlers, com risco real de banimento de conta. A decisão judicial *Meta v. Bright Data* (2024) só estabeleceu que scraping de dado público sem login não é *crime* (CFAA) — não significa que é permitido pelos termos de uso. Para uma operação que já depende de um número de WhatsApp Business (ativo sensível a banimento, mesmo ecossistema Meta), associar essa infraestrutura a scraping da própria Meta é um risco desproporcional ao ganho.

### 4.1 O que é seguro e vale considerar
- **Crawlee** (Apache 2.0, TypeScript) para scraping de **fontes públicas institucionais** — sites de empresas, diretórios B2B públicos, Google Maps Business, páginas amarelas/catálogos setoriais. Uso para **enriquecer** um `Contact` já existente (ex.: completar dados de uma empresa que já é lead), não como fonte primária de captura fria.
- **Isolamento obrigatório**: `PlaywrightCrawler`/`PuppeteerCrawler` sobem instâncias reais de Chromium — nunca rodar isso dentro do mesmo processo Express que atende sockets do WhatsApp em tempo real. Se for implementado, precisa ser um worker/processo separado com fila própria (o Whaticket já usa Redis/Bull em outras partes — reaproveitar esse padrão). Para alvos de HTML estático (sem JS), `CheerioCrawler` é bem mais leve e evita o overhead de browser.

### 4.2 O que evitar
- Scraping direto de Instagram/Facebook/LinkedIn para captura fria de leads — usar as APIs oficiais (Meta Lead Ads, por exemplo) se esse dado for necessário, mesmo com custo/limite, em vez de scraping não autorizado.

### 4.3 Mautic — reforçar o scoring que já existe, como conceito (PHP, não dá pra portar código)
O `sdrScoringRules` do `AIAgent` já existe, mas é um número único e estático. O modelo do Mautic (~10+ anos maduro) sugere 3 melhorias conceituais, aditivas sobre o que já existe:
- **Decay temporal**: pontos caem com inatividade, evitando que um lead "frio há meses" continue parecendo qualificado.
- **Múltiplas dimensões de score** (interesse em produto, engajamento, urgência) em vez de um único número somado.
- **Action → Points → Trigger** como padrão explícito: cada ação tem pontuação própria e regras de threshold disparam ações automáticas (mudar de estágio do funil, notificar humano) — já é parecido com o que existe, só formalizar a separação action/threshold/trigger deixaria mais auditável.

## 5. Como isso se encaixa no que já está em andamento

Nenhum item aqui muda a estrutura das Fases 1–8 já aprovadas (segurança de webhook, ContactCustomField, FlowBuilder, Role, OAuth Meta). São adições à lista de melhorias futuras, na seguinte ordem de prioridade sugerida:

1. **Memória de contato entre tickets** (§2.3) — menor risco, maior ganho percebido pelo atendimento, independente de qualquer outra fase.
2. **Webhook de lead do Typebot → Contact tipado** (§3.3) — pequeno, e fica ainda melhor depois que a Fase 2 (tipar `ContactCustomField`) estiver pronta.
3. **Broadcast por Tag + Sequences simples** (§3.2.1-2) — reaproveita Tags e fila já existentes.
4. **Tools tipadas no AI Agent + versionamento draft/published do agente** (§2.1/§2.2) — espelha o padrão já decidido para o FlowBuilder (Fase 5), só aplicado ao `AIAgent` depois.
5. **Funil como máquina de estados estruturada** (§2.4) — maior, fazer só depois dos itens acima estarem estáveis.
6. **Scraping de fontes públicas institucionais via Crawlee isolado** (§4.1) — opcional, só se houver demanda real de enriquecimento de lead; nunca scraping de redes sociais Meta/LinkedIn.

## 7. Aprofundamento — depois de ler o código real do AI Agent

A pedido do usuário, fui ler o código atual do AI Agent/ActionExecutor/sistema de aprendizagem antes de aprofundar a recomendação. Resultado: **boa parte do que eu ia recomendar com base nos projetos externos já existe, e em nível mais maduro do que eu esperava.** Isso muda o tom das recomendações — de "construir" para "afinar pontos específicos".

### 7.1 O que já está bem estruturado (não precisa refazer)

- **`ActionExecutor.ts` + `BotFunctions.ts`** já implementam exatamente o padrão "tool = schema declarado" que eu ia sugerir copiar do Dify: cada função (`enviar_catalogo`, `enviar_tabela_precos`, `buscar_e_enviar_arquivo`, `transferir_para_closer` etc.) tem `parameters` tipados (JSON Schema) e descrição rica orientando quando a IA deve chamar — isso já é function-calling de verdade, não string livre.
- **Autonomia para enviar materiais já existe e é bem pensada**: `enviarCatalogo`/`enviarTabelaPrecos`/`enviarInformativo`/`buscarEEnviarArquivo` buscam o arquivo certo (por tag, por busca semântica via RAG, com fallback entre sistema novo de biblioteca e sistema legado), **bloqueiam o envio se o lead não tiver CNPJ/e-mail cadastrado** (`blockSendMaterialsIfNotQualified`) e suportam tanto Baileys quanto API Oficial. Isso já é "atendente humano com embasamento da empresa" na prática.
- **A seção de aprendizagem é mais avançada do que parecia de fora**: existe versionamento de prompt com rollback e comparação (`PromptVersioning.js` + `createPromptVersion`/`rollbackToVersion`/`compareVersions`), cenários de teste (`AITestScenario`), métricas de treino, comparação A/B, visualização de fluxo de prompt e histórico de tool calls — ou seja, o padrão "draft/published com snapshot" que eu ia sugerir importar do Dify **já existe** nessa área.
- **O loop de feedback → melhoria já é estruturado**: `AITrainingFeedback` (correto/errado num cenário de sandbox) alimenta `AITrainingImprovement`, que já tem categorização (tom/precisão/empatia/vendas/roteamento/conhecimento), severidade, `improvementScore`, `verifiedInProduction` e um status (`pending → applied/rejected/testing`) com `consolidatedPrompt`. Isso é mais granular do que a maioria dos projetos que pesquisei.

### 7.2 Lacuna real confirmada (única que se mantém forte após ler o código)

**Memória entre tickets do mesmo contato continua sendo o gap genuíno.** Nada no código revisado (RAG, feedback, skills) cobre "lembrar de um contato entre atendimentos diferentes" — o contexto vivo é todo por ticket/sandbox. A recomendação do §2.3 (campo `Contact.aiMemory` + tool `salvar_memoria_contato`) continua válida e é a maior prioridade real entre tudo que foi pesquisado nesta investigação.

### 7.3 Duplicação a esclarecer (pergunta, não correção automática)

Existem **dois sistemas paralelos de "Skill"**: `Skill.ts` (com hash/versionamento semântico/status draft-active-deprecated, usado por `SkillController.ts`) e `AIAgentSkill.ts` (mais simples, usado por `SkillManagerService.ts`/`AIAgentSkillController.ts`, que é o que de fato mescla com `DEFAULT_SKILLS` para gerar o prompt do agente hoje). Não tenho contexto suficiente do código para saber se isso é intencional (ex: `Skill.ts` é uma evolução ainda não conectada) — antes de qualquer ajuste, vale confirmar com quem desenvolveu essa parte qual dos dois é o caminho vigente, em vez de eu assumir.

### 7.4 Funil como máquina de estados — mantém-se válido, mas como refinamento pontual

`FunnelStage.autoAdvanceCondition` (`TEXT` livre) confirmado no model — a recomendação do §2.4 (transições tipadas) ainda vale, mas agora como um refinamento pontual sobre uma área já bem instrumentada (há `AITestScenario` por estágio para validar), não como uma reconstrução.

## 8. Automação de comentários (Instagram/Facebook) — aprofundando o que o usuário confirmou ser a prioridade

O usuário esclareceu: "estilo ManyChat" aqui significa especificamente **responder automaticamente a comentários em posts do Instagram/Facebook via DM**, não as outras features do ManyChat. Reforçando o mecanismo (já levantado na pesquisa do ChatbotX, §3.2.3):

- A Meta tem um endpoint **oficial** pra isso (não é gambiarra): `POST /{comment-id}/private_replies`, disponível tanto pra Facebook Pages quanto Instagram (via Graph API). Não precisa de engenharia reversa.
- Fluxo: o app já estaria recebendo `comments` no webhook (é só assinar esse campo, além de `messages`, no app Meta que a Fase 7 do plano já aprovado vai configurar via OAuth) → ao chegar um evento de comentário, dar match de palavra-chave configurável → chamar o Private Reply citando o `comment_id`.
- Isso abre a janela de mensageria de **24h** com aquele usuário (msgs subsequentes dele resetam o relógio) e tem limite de **~200 DMs automáticas/hora por conta** — em picos, enfileirar o excedente.
- **Encaixe com o que já está aprovado**: isso é um produto/evento novo (`comments`) dentro da mesma infraestrutura de webhook Meta que a Fase 1 (segurança) e Fase 7 (OAuth) do plano já cobrem — não é um sistema separado. A peça que falta adicionar, quando chegar a vez: (1) assinar `comments` no webhook do canal Instagram/Facebook, (2) uma tela simples de "regra: comentário contém X → responder com Y / disparar fluxo Z do FlowBuilder", (3) a chamada ao Private Reply. Pode reaproveitar o `ActionExecutor` como o lugar de adicionar essa nova ação, seguindo o mesmo padrão das demais.

## 9. Web scraping Google + base de empresas (CNPJ/CNAE/região) — pesquisa concluída

Retomada após o reset do limite. Encontrei uma combinação de projetos que, juntos, cobrem exatamente o pedido — busca por UF/Município/CNAE usando dado público oficial (sem risco de ToS) + enriquecimento via Google Maps onde a Receita não tem contato.

### 9.1 Base de empresas por região/CNAE — dado público oficial, não é scraping

A Receita Federal disponibiliza os dados cadastrais de **todas as ~60 milhões de empresas do Brasil** (CNPJ, razão social, CNAE primário/secundário, endereço, situação cadastral, porte, capital social, sócios) como **dataset público aberto** em dados.gov.br — isso não é scraping de terceiro, é dado oficial, sem qualquer questão de ToS.

Encontrei uma pilha de 3 ferramentas do mesmo autor (rictom), que se encaixam em sequência e juntas fazem exatamente o que foi pedido:

1. **[rictom/cnpj-sqlite](https://github.com/rictom/cnpj-sqlite)** — baixa os dumps oficiais da Receita e carrega num banco SQLite local (`cnpj.db`). É o ETL inicial, roda uma vez (ou periodicamente pra atualizar).
2. **[rictom/cnpj_consulta](https://github.com/rictom/cnpj_consulta)** — **esta é a ferramenta-alvo exata do pedido**: gera listas de empresas filtradas por **UF, Município, CEP, CNAE primário ou secundário, natureza jurídica, situação cadastral, porte, opção Simples/MEI, data de início de atividade, capital social** — e exporta para Excel. Python (pywebio/pandas/sqlalchemy), tem versão script e versão executável Windows.
3. **[rictom/cnpj_api](https://github.com/rictom/cnpj_api)** — API Python pra consulta programática sobre o mesmo banco, caso prefira integrar em vez de gerar Excel manualmente.

Alternativa para consulta unitária rápida (enriquecer um lead que já se tem o CNPJ, não buscar em massa): **[cuducos/minha-receita](https://github.com/cuducos/minha-receita)** (1.6k stars, API REST) — vale notar que o repo no GitHub está marcado "archived" desde janeiro/2026, mas **o projeto não foi abandonado**, só migrou de plataforma para `codeberg.org/cuducos/minha-receita` (continua mantido lá).

**Consideração de infraestrutura**: a base completa tem ~60 milhões de registros — o SQLite gerado pelo `cnpj-sqlite` ocupa vários GB em disco. Isso precisa rodar como processo batch separado (igual já recomendado para o Crawlee no §4.1), nunca dentro do processo Express principal, e precisa de um volume de disco dedicado.

### 9.2 Enriquecimento de contato (telefone/site/e-mail) via Google Maps

A base da Receita Federal **não tem telefone/e-mail confiável** (o campo de contato do cadastro raramente é atualizado pelas empresas). Pra isso, **[gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper)** (4.6k stars, MIT, **muito ativo — release no mesmo dia desta pesquisa**) é uma ferramenta madura:

- Extrai nome, endereço, telefone, site, avaliação, nº de reviews, latitude/longitude e **e-mail** (visita o site do negócio e tenta extrair).
- Suporta filtro geográfico real: coordenadas + raio, ou varredura por bounding-box pra cobrir uma região inteira.
- Filtro por categoria/palavra-chave (ex.: pesquisar pelo CNAE/segmento já filtrado na etapa anterior).
- Throughput ~120 lugares/minuto; escala distribuída via Postgres pra volumes maiores.
- Deploy flexível: CLI, Web UI, REST API, Kubernetes, AWS Lambda — dá pra rodar como job isolado (mesma lógica de isolamento já recomendada para o Crawlee).
- **A própria ferramenta já inclui aviso legal**: "use de forma responsável; scraping não autorizado pode violar os termos de serviço [do Google]". Diferente do scraping de Meta/LinkedIn (que arrisca a conta de WhatsApp Business pelo mesmo ecossistema), aqui o risco é mais contido — mas ainda assim, throttling responsável (não agressivo) é a recomendação, não rodar no limite do throughput.

### 9.3 Pipeline sugerido, de ponta a ponta

1. **Buscar**: `cnpj_consulta` filtra empresas por UF + Município + CNAE → lista com CNPJ, razão social, endereço (dado oficial, sem risco).
2. **Enriquecer contato**: para cada empresa (ou por região/categoria, em lote), `google-maps-scraper` busca o mesmo nome/categoria na região pra obter telefone, site e e-mail.
3. **Importar como leads**: os dois resultados (CNPJ + contato) se cruzam por nome/endereço e alimentam a criação de `Contact` em lote no Whaticket — reaproveitando a tipagem de `ContactCustomField` já planejada (Fase 2) pra guardar CNAE/porte/segmento como campos estruturados do lead.
4. **Abordagem personalizada**: a parte de "gerar uma abordagem exclusiva e disparar por e-mail e WhatsApp API oficial" não precisa de pesquisa adicional — é lógica de negócio direta de implementar depois, reaproveitando o que já existe: o AI Agent já tem geração de mensagem com tom configurável (`brandVoice`, `toneStyle`) e o canal WhatsApp API oficial já está pronto; só falta o envio por e-mail como canal adicional (hoje o Whaticket parece ser só WhatsApp/Meta) e uma fila de disparo com rate-limit, no mesmo padrão já sugerido para broadcast (§3.2.1).

**Nenhuma dessas ferramentas roda em Node/TS** (Python e Go) — a integração correta é como **processo/job batch separado e isolado**, gerando uma lista (CSV/Excel ou inserindo num banco compartilhado) que o backend do Whaticket consome para criar/atualizar `Contact` em lote, e não como dependência embutida no backend.

## 10. Referências

- https://github.com/langgenius/dify
- https://github.com/mastra-ai/mastra
- https://github.com/letta-ai/letta
- https://github.com/langchain-ai/langgraph
- https://github.com/ChatbotXIO/ChatbotX
- https://github.com/zernio-dev/zernflow
- https://github.com/baptisteArno/typebot.io
- https://github.com/apify/crawlee
- https://github.com/mautic/mautic
- Meta for Developers — [Instagram Private Replies](https://developers.facebook.com/docs/instagram-platform/private-replies/), [Instagram Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks)
- Código do whaticket revisado nesta sessão: [ActionExecutor.ts](backend/src/services/IA/ActionExecutor.ts), [BotFunctions.ts](backend/src/services/IA/BotFunctions.ts), [AISkill.ts](backend/src/services/IA/AISkill.ts), [SkillManagerService.ts](backend/src/services/AIAgentServices/SkillManagerService.ts), [Skill.ts](backend/src/models/Skill.ts), [AIAgentSkill.ts](backend/src/models/AIAgentSkill.ts), [AITrainingFeedback.ts](backend/src/models/AITrainingFeedback.ts), [AITrainingImprovement.ts](backend/src/models/AITrainingImprovement.ts), [AITestScenario.ts](backend/src/models/AITestScenario.ts), [TrainingExample.ts](backend/src/models/TrainingExample.ts), [TrainingDataset.ts](backend/src/models/TrainingDataset.ts), [AITraining/index.js](frontend/src/pages/AITraining/index.js), [PromptVersioning.js](frontend/src/components/AITraining/PromptVersioning.js)
- https://github.com/rictom/cnpj-sqlite, https://github.com/rictom/cnpj_consulta, https://github.com/rictom/cnpj_api, https://github.com/rictom/rede-cnpj
- https://github.com/cuducos/minha-receita (migrado para codeberg.org/cuducos/minha-receita)
- https://github.com/gosom/google-maps-scraper
