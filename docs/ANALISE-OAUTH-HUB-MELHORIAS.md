# Análise: o que aproveitar do oauth-hub-zdg para conexões Meta no Whaticket

> Investigação de viabilidade — material de referência, não plano aprovado para execução.

## 1. Resumo executivo

Diferente do Twenty (stacks incompatíveis), aqui o alvo é muito mais estreito: o [oauth-hub-zdg](https://github.com/pedroherpeto/oauth-hub-zdg) é um microsserviço pequeno (~2.700 linhas TS) cuja única missão é resolver exatamente a dor que vocês relataram — **conectar canais da Meta (WhatsApp Cloud API, Messenger, Instagram) sem fricção**, via OAuth/Embedded Signup, em vez de copiar/colar tokens manualmente.

Comparei com o que existe hoje no Whaticket e o achado é direto: **o Whaticket hoje conecta canais Meta por formulário manual (colar App ID/Secret/Token) e tem pelo menos duas lacunas de segurança reais** (token de verificação de webhook compartilhado entre empresas, com fallback hardcoded; nenhuma verificação de assinatura HMAC nos webhooks). O oauth-hub resolve isso de forma madura.

⚠️ **Sobre a licença:** o oauth-hub-zdg é **AGPL-3.0**. Como o projeto de vocês **não será comercializado e ficará todo em código aberto** também, a principal restrição prática da AGPL (obrigação de disponibilizar o código-fonte a quem acessa o serviço pela rede) já é satisfeita pelo próprio fato de o repositório ser público — isso **libera a opção de copiar/adaptar o código diretamente para dentro do backend**, e não só rodá-lo como serviço separado. Ver §5 para o que isso muda na prática.

## 2. O que é o oauth-hub-zdg

- Projeto da comunidade ZDG (mesma comunidade do **Z-PRO**, um fork/produto de multiatendimento via WhatsApp — ou seja, foi feito por gente que resolve o mesmo problema de vocês).
- Stack mínima: Node 18+, Express, sem banco — persiste em `data/*.json` (apps, canais, eventos).
- Conceito central: **multi-app, multi-canal, multi-tenant via "Apps"**. Cada "App" cadastrado no painel tem suas próprias credenciais Meta, seu próprio Verify Token, sua própria URL de webhook (`/webhook/app/<id>`), e sua própria lista de destinos de encaminhamento ("forwards").
- Fluxo: usuário clica em "Conectar WhatsApp/Messenger/Instagram" → OAuth/Embedded Signup da Meta → hub troca o `code` por token no servidor → descobre automaticamente os números/páginas/contas disponíveis → assina o app nos webhooks daquele canal (`subscribed_apps`) → passa a receber e **encaminhar** os webhooks para a URL do sistema de destino (no caso de vocês, seria o Whaticket).

## 3. Situação atual do Whaticket (o que eu encontrei no código)

| Aspecto | Hoje no Whaticket |
|---|---|
| Conexão de canal Meta | Formulário manual — [MetaAPIFields.js](frontend/src/components/WhatsAppModal/MetaAPIFields.js) / [OfficialAPIFields.js](frontend/src/components/WhatsAppModal/OfficialAPIFields.js): usuário cola App ID, App Secret, Access Token, Phone Number ID, etc. à mão. |
| Descoberta de páginas/números | Não existe. Se a Meta tem múltiplas Páginas/números no Business Manager, é o usuário que precisa achar o ID certo manualmente no Meta Business Suite. |
| Endpoint de webhook | **Único e global**: `/webhooks/whatsapp` ([whatsappWebhookRoutes.ts](backend/src/routes/whatsappWebhookRoutes.ts)) e `/` genérico ([webHookRoutes.ts](backend/src/routes/webHookRoutes.ts)) — não há um endpoint por número/empresa. |
| Verify Token | **Compartilhado entre todas as empresas** via uma única env var, com fallback hardcoded: `process.env.WABA_WEBHOOK_VERIFY_TOKEN \|\| "meu_token_secreto"` ([WhatsAppWebhookController.ts:33](backend/src/controllers/WhatsAppWebhookController.ts#L33)). Se a env var não for configurada em algum ambiente, o token de verificação é literalmente uma string pública no código-fonte. |
| Assinatura do webhook (`X-Hub-Signature-256`) | **Não verificada em nenhum lugar** — busquei em todo o backend e não há checagem de assinatura HMAC. Qualquer requisição POST para a URL do webhook (se descoberta) é processada como se fosse legítima da Meta. |
| Modelo de dados | [Whatsapp.ts](backend/src/models/Whatsapp.ts) já tem os campos certos (`metaAppId`, `metaAppSecret`, `wabaPhoneNumberId`, `instagramAccountId`, etc.) — a estrutura para guardar a conexão existe, falta o fluxo de preenchimento automatizado. |

Isso confirma o que vocês relataram: a dificuldade não é "o Whaticket não sabe falar com a Meta" — ele sabe (há `OfficialAPIAdapter`, `InstagramAdapter`, `FacebookServices`, `MetaServices`). A dificuldade é o **processo de conexão** (achar IDs, colar tokens certos, um por um) e duas **lacunas de segurança** que o hub já resolveu.

## 4. O que o oauth-hub-zdg faz bem (e por que vale estudar)

### 4.1 Embedded Signup / OAuth de verdade (em vez de colar token)
[meta.ts](https://github.com/pedroherpeto/oauth-hub-zdg/blob/main/src/meta.ts) implementa o ciclo completo: `exchangeCodeForToken` → `getLongLivedUserToken` → descoberta de recursos → `subscribeWabaApp`/`subscribePageApp`/`subscribeInstagramApp`. O usuário só clica em "Conectar"; o hub faz o resto no servidor (o App Secret nunca vai ao navegador).

### 4.2 Descoberta resiliente de Páginas/WABA/Instagram
Este é o pedaço mais valioso tecnicamente. A Meta tem **múltiplos caminhos** para a mesma informação dependendo de como o usuário concedeu permissão, e o hub tenta todos em cascata:
1. `/me/accounts` (caminho feliz)
2. Token de longa duração + `/me/accounts` de novo
3. **Granular scopes via `/debug_token`** — quando o login é "Facebook Login for Business", `pages_show_list` costuma não vir, então `/me/accounts` retorna vazio mesmo com a Página escolhida; os IDs aparecem em `granular_scopes[].target_ids` e precisam ser resolvidos individualmente (`getPagesViaGranularScopes`)
4. Fallback via Business Manager (`/me/businesses` → `owned_pages`/`client_pages`)
5. Fallback via token "System User" salvo manualmente (`messengerFallbackToken`) para quando nenhum OAuth resolve

Isso é exatamente o tipo de "edge case que só se aprende na dor" que costuma ser a maior fonte de chamado de suporte em integração com Meta — vale muito como referência, independente de copiar código.

### 4.3 Segurança de webhook correta
- `verifyWebhookSignature` em [security.ts](https://github.com/pedroherpeto/oauth-hub-zdg/blob/main/src/security.ts) — HMAC-SHA256 com o App Secret, comparação em tempo constante (`crypto.timingSafeEqual`), aceitando o secret do app principal OU do app de Instagram (quando são apps separados).
- Verify Token **por app/conexão**, não global.
- State assinado (HMAC, TTL 30 min) protegendo o fluxo OAuth contra CSRF.

### 4.4 Roteamento multi-tenant nativo
Cada "App" tem sua própria URL de webhook (`/webhook/app/<id>`) e sua própria lista de encaminhamento. Isso resolve de fábrica o problema de "qual empresa/conexão esse webhook pertence" — algo que hoje o Whaticket provavelmente infere de outro jeito (pelo `phone_number_id`/`page_id` no payload, dentro do endpoint único), o que funciona mas mistura a responsabilidade de roteamento com a de processamento de mensagem.

### 4.5 Recurso extra interessante: gerador de evidências para o App Review da Meta
[evidence.ts](https://github.com/pedroherpeto/oauth-hub-zdg/blob/main/src/evidence.ts) automatiza chamadas reais à Graph API por permissão solicitada e gera um documento de evidência — usado para o processo de **App Review** da Meta (obrigatório para sair do modo de desenvolvimento/sandbox). Se vocês já passam por esse processo manualmente, isso economiza tempo real.

## 5. Como aproveitar — o que muda por não ser comercial e ser tudo open source

Com o projeto sendo **não-comercial e totalmente open source**, a leitura da AGPL-3.0 muda bastante:

- A obrigação central da AGPL é: quem opera o programa como serviço de rede deve permitir que os usuários que interagem com ele **obtenham o código-fonte correspondente à versão em execução**. Com o repositório do Whaticket público, isso já fica satisfeito de forma trivial — não há "vazamento" de propriedade intelectual a evitar, porque não há propriedade intelectual fechada nesse cenário.
- MIT (licença atual do Whaticket) é compatível com AGPL — código MIT pode ser combinado com código AGPL, resultando numa obra combinada sob AGPL. Isso é permitido pela própria MIT (que autoriz sublicenciamento), só que **na prática isso significa que os arquivos/módulos que incorporarem código do oauth-hub-zdg passam a ser regidos pela AGPL-3.0** (precisam manter o aviso de copyright/licença original do oauth-hub-zdg) — o que é perfeitamente aceitável aqui, já que tudo será aberto de qualquer forma.
- Isso **libera a opção de copiar/adaptar diretamente** a lógica de `meta.ts` (troca de código por token, descoberta em cascata de Páginas/WABA/Instagram) e `security.ts` (verificação HMAC, state assinado) para dentro do backend do Whaticket, em vez de depender de um serviço externo. Só é preciso:
  1. Manter o cabeçalho de copyright/licença AGPL-3.0 nos arquivos/módulos adaptados (não pode "virar MIT" silenciosamente).
  2. Deixar claro no README/CONTRIBUTING que essa parte específica do código é AGPL-3.0 (licenciamento misto dentro do mesmo repositório é comum e legal, desde que documentado).

A alternativa de rodar o oauth-hub-zdg como microsserviço separado (sidecar, usando a função nativa de "encaminhamento" dele) continua válida e ainda é o caminho de **menor esforço de implementação** — só que agora a escolha entre as duas é puramente de engenharia (manutenção de mais um serviço vs. integração mais profunda no fluxo de conexão existente), não mais uma questão de risco jurídico.

**Recomendação prática: dado que não há mais barreira de licença, vale integrar a lógica de descoberta (§4.1/4.2) e segurança de webhook (§4.3) direto no backend do Whaticket (mantendo o aviso AGPL nesses arquivos) — fica mais simples de manter do que operar um serviço extra, e entrega a experiência de conexão dentro do próprio wizard do WhatsApp Modal.**

## 6. Plano de ação sugerido

> Todos os itens abaixo são **aditivos** — nenhum remove ou quebra uma configuração/conexão que já esteja funcionando hoje. Conexões Meta já configuradas via formulário manual continuam funcionando sem qualquer ação do usuário.

**Quick win de segurança (fazer já, esforço baixo, sem questão de licença, sem quebrar nada existente):**
1. Implementar verificação de `X-Hub-Signature-256` no `WhatsAppWebhookController`/`WebHookController`, usando `metaAppSecret`/`wabaAccessToken` por registro `Whatsapp` (não um secret global). A lógica é trivial (HMAC-SHA256 + `crypto.timingSafeEqual`) e é mecânica documentada pela própria Meta — não há nada a "copiar", é reimplementar o padrão padrão da indústria. Sugestão: começar em modo "log apenas" (logar quando a assinatura não bate, sem rejeitar) para validar contra tráfego real antes de bloquear, e só então passar a rejeitar — evita quebrar conexões existentes por configuração inesperada.
2. **Adicionar** suporte ao token **por conexão/empresa** usando o campo `metaWebhookVerifyToken` que já existe em `Whatsapp.ts` (hoje sem uso no controller) — sem remover o `WABA_WEBHOOK_VERIFY_TOKEN` global, que continua funcionando como fallback para quem não configurar um token por conexão. O único ponto que deve mudar é o **literal hardcoded** `"meu_token_secreto"` como valor padrão (isso não é "lógica em uso", é um valor de exemplo inseguro que nunca deveria ter sido um default silencioso) — trocar por: se nenhuma env var nem token por conexão estiver configurado, falhar a verificação explicitamente em vez de aceitar uma senha pública conhecida.

**Médio prazo (maior ganho de UX para o problema relatado):**
3. Portar a lógica de `meta.ts` (troca de código por token, descoberta em cascata via `/me/accounts` → token de longa duração → granular scopes via `/debug_token` → Business Manager → fallback de token manual) para um novo módulo em `MetaServices`/`FacebookServices`, mantendo o aviso de copyright AGPL-3.0 do oauth-hub-zdg no topo do(s) arquivo(s) adaptado(s). Isso **adiciona** um botão "Conectar automaticamente" que faz Embedded Signup de ponta a ponta — o formulário manual do `MetaAPIFields.js`/`OfficialAPIFields.js` continua existindo lado a lado (necessário para quem já tem token/IDs configurados, para ambientes onde o app Meta não tem Embedded Signup habilitado, e como via de edição/correção manual quando precisar).
4. Alternativa de menor esforço (se preferirem não tocar no wizard de conexão agora): subir o oauth-hub-zdg como serviço auxiliar (Docker, já vem pronto) só para o **fluxo de conexão**, configurando o "forward" dele para apontar para o endpoint de webhook que o Whaticket já tem — sem alterar o processamento de webhook existente.

**Avaliar conforme volume de uso:**
5. Se o app dos clientes ainda está em modo de desenvolvimento na Meta (sandbox/teste), o gerador de evidências (§4.5) pode valer a pena replicar para acelerar o App Review — caso contrário, não é prioridade.

## 7. O que não vale a pena

- Copiar o repositório inteiro (painel, i18n, gerador de evidências, etc.) — só os módulos `meta.ts`/`security.ts` (lógica pura, sem UI) têm valor de reuso direto; o resto é específico do produto deles (painel "Mission Control" deles, multi-app via JSON).
- Adotar o armazenamento em arquivo JSON dele (`data/*.json`) — o Whaticket já tem Postgres/MySQL via Sequelize; não há motivo para regredir a persistência.
- Implementar o painel "Mission Control" dele (dashboard de eventos em tempo real) — é redundante com telas que o Whaticket já tem para acompanhar tickets/mensagens.

## 8. Frontend do oauth-hub-zdg — o que vale estudar

Vale destacar separado porque é uma descoberta independente da parte de conexão Meta: o painel deles (`public/`) é **JS vanilla puro, sem framework, sem build step** — `app.js` (1.151 linhas), `styles.css` (859 linhas), `index.html` (425 linhas), mais um `i18n.js` de 51 linhas. Não tem nada de React/Vue ali; é tudo `document.getElementById` + template strings. Ainda assim, o resultado visual e de UX é bem mais "produto SaaS moderno" do que a média de painel admin — vale estudar os **padrões**, não a stack (o Whaticket é React+MUI e deve continuar sendo; não há motivo para "vanilla-izar" nada).

### 8.1 Sistema de design via CSS custom properties (tema claro/escuro de verdade)
Em [styles.css](https://github.com/pedroherpeto/oauth-hub-zdg/blob/main/public/styles.css) todo o tema é tokens (`--bg`, `--surface`, `--text`, `--muted`, `--signal`, `--ok/--warn/--danger`, `--sh`/`--sh-md`/`--sh-lg` para sombras, `--r`/`--r-lg` para radius) redefinidos sob `:root[data-theme="dark"]`. É uma paleta "ink neutro + um único acento esmeralda", deliberadamente restrita — não tenta usar 10 cores, usa 1 cor de destaque + neutros bem calibrados em ambos os modos.

**No Whaticket hoje:** o tema vem de `createTheme`/`ThemeProvider` do MUI em [App.js](frontend/src/App.js#L69) — funcionalmente equivalente (MUI também faz tema claro/escuro), mas a pergunta que vale fazer é se a paleta de cores atual tem essa mesma disciplina (poucas cores, alto contraste, tokens claros de "muted"/"surface"/"border") ou se foi crescendo ad-hoc. Vale uma auditoria visual rápida comparando os dois lado a lado — é um ajuste de paleta dentro do tema do MUI, não uma reescrita.

**Detalhe técnico pequeno e fácil de copiar:** o script inline no `<head>` que lê o tema salvo (`localStorage`) e aplica **antes do primeiro paint** ([index.html:8](https://github.com/pedroherpeto/oauth-hub-zdg/blob/main/public/index.html#L8)) evita o "flash" de tema claro antes de trocar pra escuro no carregamento. Vale conferir se o Whaticket tem esse mesmo cuidado no `public/index.html` do CRA.

### 8.2 Command palette (Ctrl/⌘+K)
Busca global por comando/navegação, ativada por atalho de teclado — confirmei que **não existe nada parecido no Whaticket hoje** (procurei por padrões de cmdk/command-palette no frontend e não achei). Para um sistema com tantas telas (tickets, contatos, campanhas, flow builder, AI agents, configurações...), um command palette tipo Linear/Raycast economiza muitos cliques pra quem já conhece o produto. É uma feature isolada e aditiva — daria pra introduzir com uma lib pronta (`kbar`, `cmdk` da Vercel) sem tocar no resto.

### 8.3 Confirmação customizada em vez de `confirm()`/`alert()` nativo
`confirmModal()` em `app.js` substitui o `window.confirm` nativo por um modal consistente com o resto do design, com foco preso (`focus trap`), `Escape` fecha, e retorna uma Promise. **No Whaticket:** já usam `sweetalert2`, que cobre esse caso — não é um gap, é um ponto onde o Whaticket já está coberto.

### 8.4 Toast simples e padronizado
Um único elemento de toast reaproveitado (`toast(msg, isError)`), sem fila de múltiplas notificações empilhadas. **No Whaticket:** já existe `react-toastify` — equivalente ou superior (suporta fila). Não é gap.

### 8.5 "Bento grid" de KPIs + sparkline + mix de canais
A tela de visão geral usa um grid de cards de KPI (`.bento`/`.col-3`/`.col-8`) com número grande, ícone, e um mini-gráfico de atividade da última hora — um padrão comum em dashboards modernos (Vercel, Linear, Stripe). **No Whaticket:** há `chart.js`/`recharts` disponíveis; o gap não é tecnológico, é de **composição visual** — se houver uma tela de dashboard/overview, vale revisar se ela usa esse tipo de layout "bento" ou um layout mais tradicional de tabela/lista. Sem ver a tela atual não dá pra afirmar o tamanho do gap — recomendo só se houver intenção de revisar uma tela de visão geral específica.

### 8.6 i18n minimalista via atributos `data-i18n`
O `i18n.js` (51 linhas) aplica traduções via `data-i18n="chave"` no HTML, detecta idioma do navegador, persiste escolha no `localStorage`, dispara evento `i18n:changed`. **No Whaticket:** já usa `i18next` + `react-i18next`, que é estritamente mais robusto (interpolação, pluralização, namespaces, lazy loading). Não é gap — o Whaticket já está num patamar acima aqui.

### 8.7 Tela de boas-vindas (onboarding de primeiro acesso)
Uma tela "welcome" simples antes do painel, com canais suportados e CTAs (inscrever no YouTube, conhecer o produto) — característica de produto auto-hospedado pensado para ser descoberto sozinho. Pouca aplicação direta no Whaticket, que já tem fluxo de login/setup próprio.

### 8.8 Resumo do que vale levar
- **Auditoria de paleta de cores** seguindo a disciplina "poucos tokens, 1 acento, neutros calibrados nos dois temas" — ajuste dentro do tema MUI existente, baixo esforço.
- **Script anti-flash de tema no `<head>`** do `index.html` do CRA — 5 minutos, sem risco.
- **Command palette (Ctrl/⌘+K)** — única peça genuinamente nova e ausente hoje; maior esforço (integrar lib + mapear ações/rotas), mas maior ganho de produtividade para usuários frequentes.
- Toast, confirm modal e i18n: nada a fazer, o Whaticket já tem equivalentes melhores.

## 9. Referências

- https://github.com/pedroherpeto/oauth-hub-zdg (AGPL-3.0)
- Arquivos revisados no clone: `src/index.ts`, `src/meta.ts`, `src/security.ts`, `src/webhook-parse.ts`, `src/types.ts`, `README.md`, `public/index.html`, `public/app.js`, `public/styles.css`, `public/i18n.js`
- Pontos correspondentes no Whaticket: [Whatsapp.ts](backend/src/models/Whatsapp.ts), [WhatsAppWebhookController.ts](backend/src/controllers/WhatsAppWebhookController.ts), [WebHookController.ts](backend/src/controllers/WebHookController.ts), [whatsappWebhookRoutes.ts](backend/src/routes/whatsappWebhookRoutes.ts), [webHookRoutes.ts](backend/src/routes/webHookRoutes.ts), [MetaAPIFields.js](frontend/src/components/WhatsAppModal/MetaAPIFields.js), [OfficialAPIFields.js](frontend/src/components/WhatsAppModal/OfficialAPIFields.js), [App.js](frontend/src/App.js)
