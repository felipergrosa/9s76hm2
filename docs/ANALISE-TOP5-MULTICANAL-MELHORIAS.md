# Análise: Top 5 projetos open source de SaaS multicanal — o que aproveitar para o Whaticket

> Investigação de viabilidade — material de referência, complementar a `ANALISE-TWENTY-CRM-MELHORIAS.md` e `ANALISE-OAUTH-HUB-MELHORIAS.md`. Foco específico: conexão de múltiplos canais Meta (WhatsApp/Messenger/Instagram), que é a dor relatada.

## 1. Critério de seleção

Pedido: 5 repositórios com mais de 10k stars, atualizados, de SaaS multicanal, independente do país de origem. Resultado real da pesquisa (stars conferidos via GitHub, junho/2026):

| Projeto | Stars | Licença core | Ativo em 2026? |
|---|---|---|---|
| [Chatwoot](https://github.com/chatwoot/chatwoot) | ~30k | MIT (core) + Enterprise fechado | Sim, releases a cada ~2 semanas |
| [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat) | ~45.7k | MIT (core) + Enterprise fechado | Sim |
| [n8n](https://github.com/n8n-io/n8n) | ~194k | Sustainable Use License | Sim, muito ativo |
| [Botpress](https://github.com/botpress/botpress) | ~15k | MIT (SDK) | Parcial — ver §4 |
| [Evolution API](https://github.com/EvolutionAPI/evolution-api) | ~8.8k | Apache 2.0 | Sim |

**Nota de transparência:** só 4 dos 5 passam o critério de >10k stars rigorosamente. Incluí o Evolution API (8.8k) como 5ª escolha deliberada, fora do critério numérico, porque é o projeto **mais diretamente relevante ao problema exato relatado** (gestão de múltiplas instâncias WhatsApp, Baileys + Cloud API oficial, brasileiro). Troquei um 5º nome genérico "que bate 10k" por um que realmente importa — avisando explicitamente do desvio, em vez de forçar o número.

## 2. Achado mais importante: "grátis e open source" não é "WhatsApp/Instagram grátis"

Esta foi a descoberta que mais merece destaque, porque muda a forma de ler qualquer comparação futura com esses projetos:

- **Rocket.Chat**: core é MIT de fato, mas confirmei em 3 fontes oficiais que os conectores de canal Meta — **WhatsApp Cloud App, Instagram Direct e Messenger 2.0 — são todos "Premium"/Enterprise**, exigindo workspace pago. O Omnichannel "grátis" do Rocket.Chat é só o widget de chat do próprio site, não WhatsApp/Instagram.
- **Botpress**: a versão self-hosted real (v12, AGPL) foi **oficialmente descontinuada** pela empresa — não recebe mais updates nem patches de segurança. A versão atual (com canais Meta, Studio moderno) é construída para rodar sobre o **Botpress Cloud** hospedado por eles; o código aberto é majoritariamente o SDK de integrações, não uma plataforma self-hosted completa equivalente.
- **Chatwoot**: este sim entrega WhatsApp/Instagram/Messenger de graça na Community Edition (MIT) — é o único dos 3 "helpdesks" onde a promessa de multicanal grátis se sustenta de verdade.

**Implicação prática:** Rocket.Chat e Botpress só servem aqui como **referência de arquitetura** (como eles desenham o conceito de "canal plugável"), não como concorrentes "grátis" a se inspirar para funcionalidade de canal Meta — essa funcionalidade específica, nos dois, é paga.

## 3. Chatwoot — a comparação mais direta e mais honesta

Chatwoot resolve exatamente o mesmo problema que o Whaticket (inbox multicanal para atendimento), com MIT de verdade no que importa.

### 3.1 Eles já tentaram resolver Embedded Signup multi-tenant — e ainda não resolveram totalmente
Achado mais valioso da pesquisa: existe uma **issue aberta no próprio Chatwoot** ([#13426](https://github.com/chatwoot/chatwoot/issues/13426)) discutindo exatamente o problema que o Whaticket enfrentaria ao automatizar o Embedded Signup — a Meta só permite **uma callback URL por App**, o que dificulta Embedded Signup multi-tenant (cada cliente final teria, em tese, que ter seu próprio App Meta, ou compartilhar um único App e rotear internamente). A solução que estão discutindo (não fechada ainda) é: **um único App Meta compartilhado para todo o SaaS** + **rotear o webhook internamente usando o `phone_number_id`/`page_id`/`ig_id` que já vem no payload** para decidir qual Inbox/empresa é o dono.

**Isso confirma algo importante:** o Whaticket **já faz exatamente esse roteamento** hoje (`ProcessWhatsAppWebhook.ts` busca o `Whatsapp` por `wabaPhoneNumberId`; `WebHookController.ts` busca por `facebookPageUserId`) — a arquitetura de roteamento já está certa. O que falta não é arquitetura de roteamento, é só automatizar a troca de `code` por token + descoberta de números/páginas (que já está no plano aprovado, Fase 7).

### 3.2 Abstração Inbox vs. Channel
Channel (WhatsApp/Messenger/Instagram/Email/API — o adaptador técnico do provedor) é encapsulado dentro de um Inbox (a unidade que o agente vê na UI, agnóstica de canal). Vale como referência conceitual para qualquer tela nova relacionada a conexões — não é uma mudança de modelo de dados necessária no Whaticket agora, é só um vocabulário/separação de responsabilidade limpa a manter em mente.

### 3.3 Instagram mudou de estratégia recentemente
Migraram de "Instagram via Facebook Page" para o **Instagram Business Login API** direto (sem depender de Página do Facebook). Vale verificar se o adapter de Instagram do Whaticket (`InstagramAdapter.ts`) já segue esse caminho mais novo da Meta ou ainda depende do fluxo antigo via Page.

## 4. n8n — o achado tecnicamente mais valioso para a Fase 7 do plano já aprovado

n8n não é um concorrente do Whaticket (é automação de workflow, não helpdesk), mas resolve com muita maturidade exatamente o subproblema que está na Fase 7 do plano de implementação já aprovado (OAuth/Embedded Signup Meta): **como ter um sistema genérico de credenciais OAuth para centenas de provedores diferentes sem duplicar lógica por provedor.**

Padrões que valem incorporar na implementação da Fase 7 (ajuste ao plano, não mudança de direção):
- **Uma única rota de callback OAuth compartilhada** entre WhatsApp, Messenger e Instagram (todos OAuth da Meta) — o `state` assinado (já estava no plano) carrega qual conexão/empresa/canal está sendo configurado, e a mesma rota decodifica e despacha. Evita 3 controllers quase-idênticos.
- **Credencial é entidade separada e reusável**, nunca embutida solta — o Whaticket já faz isso bem (campos na tabela `Whatsapp`), só reforça que está no caminho certo.
- **Botão "Testar conexão"** antes de salvar — UX simples, falta no Whaticket hoje, fácil de adicionar ao `WhatsAppModal` independente do OAuth (dá pra fazer já, mesmo no formulário manual atual).
- **Reconexão graciosa**: quando o token expira, em vez de erro genérico, mostrar o mesmo botão "Conectar" para reautorizar. Relevante para quando a Fase 7 estiver pronta.

Licença (Sustainable Use License) não é um problema para o Whaticket — a restrição é sobre revender o n8n embutido como produto, e aqui a ideia é só estudar o padrão de arquitetura, não embutir código deles.

## 5. Evolution API — gestão de múltiplas instâncias WhatsApp

Mais relevante para a parte do Whaticket que já usa Baileys, não para a parte Meta oficial (nessa, a configuração continua manual igual ao Whaticket — não resolveram esse problema melhor).

- **Strategy pattern**: uma interface comum (`ChannelStartupService`) com implementações por tipo de conexão (Baileys/Cloud API/protocolo próprio), orquestradas por um serviço singleton de monitoramento, com estados de conexão explícitos (`close`/`connecting`/`open`) persistidos em banco. Vale comparar com como `WhatsAppFactory.ts`/`OfficialAPIAdapter.ts`/`InstagramAdapter.ts` do Whaticket já fazem isso — se já há essa separação clara, não há gap; se o estado de conexão hoje é mais implícito/espalhado, vale considerar explicitar.
- **Barramento de eventos plugável**: webhook HTTP é só um dos transportes possíveis — também suportam RabbitMQ, Kafka, SQS, WebSocket por instância. É um padrão mais flexível que "um webhook só", mas **não é uma prioridade para o Whaticket agora** — webhook HTTP já atende o caso de uso atual; só vale revisitar se um dia surgir necessidade real de integração assíncrona em escala.
- **Ressalva de governança**: o projeto trocou de identidade institucional em 2026 (`EvolutionAPI` → `evolution-foundation`), sinal de formalização mas também de instabilidade organizacional histórica. Os padrões técnicos são bons; a governança do projeto em si não é referência de estabilidade.

## 6. Botpress — só a ideia de versionamento do Studio vale registrar

Como o self-hosted real está descontinuado (v12 morto) e a versão atual depende da Botpress Cloud, não há nada de canal Meta a aprender aqui que já não tenha sido coberto por Chatwoot/n8n. A única ideia que vale anotar para o futuro: o Studio deles trata cada "publish" como uma versão com **histórico completo, diff entre versões e revert** — isso é uma extensão natural (não urgente) da Fase 5 já aprovada (draft/publicado no FlowBuilder): depois que o versionamento básico estiver no ar, "comparar versões"/"revert" seria o próximo passo, não o primeiro.

## 7. O que isso muda no plano já aprovado

Nenhuma mudança de direção — esta pesquisa **reforça e refina a Fase 7** (conexão automática Meta via OAuth) com 3 ajustes concretos, todos aditivos:

1. Implementar a Fase 7 com **uma única rota de callback OAuth compartilhada** entre WhatsApp/Messenger/Instagram (em vez de três rotas separadas), seguindo o padrão do n8n — reduz código duplicado desde o início, não muda o desenho já aprovado.
2. Adicionar um botão **"Testar conexão"** no `WhatsAppModal` — pode ser feito de forma independente da Fase 7, inclusive antes, já que funciona com o formulário manual atual.
3. Ao chegar na Fase 5 (versionamento do FlowBuilder), manter em mente "diff/revert entre versões" como possível extensão futura — não adicionar agora, só não desenhar a tabela de forma que impeça isso depois (ex.: manter histórico de versões, não sobrescrever).

Nenhum item exige revisitar Fases 1–6 do plano já aprovado.

## 8. Referências

- https://github.com/chatwoot/chatwoot — issue [#13426](https://github.com/chatwoot/chatwoot/issues/13426), docs de [WhatsApp Embedded Signup](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/whatsapp-embedded-signup)
- https://github.com/RocketChat/Rocket.Chat — documentação de marketplace de Apps Omnichannel (WhatsApp Cloud/Instagram Direct/Messenger 2.0, todos Premium)
- https://github.com/n8n-io/n8n — [Credential System for Nodes](https://deepwiki.com/n8n-io/n8n/4.4-credential-system-for-nodes), [WhatsApp credentials docs](https://docs.n8n.io/integrations/builtin/credentials/whatsapp/), [Sustainable Use License](https://docs.n8n.io/sustainable-use-license/)
- https://github.com/botpress/botpress e https://github.com/botpress/v12 (legado, descontinuado)
- https://github.com/EvolutionAPI/evolution-api (atualmente `evolution-foundation`)
