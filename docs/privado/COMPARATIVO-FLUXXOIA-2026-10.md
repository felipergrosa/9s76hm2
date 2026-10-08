# Comparativo 9s76hm2 vs Fluxoo (cloud.fluxxoia.com)

**Data:** 2026-10-07
**Método:** raspagem autenticada via agent-browser + extração do bundle JS (rotas e itens de menu reais, incluindo telas bloqueadas por permissão do plano trial).
**Conta analisada:** testefluxxo@gmail.com (plano trial; algumas telas retornam 403 por permissão, mas constam no bundle/menu).

---

## 1. Inventário do produto de referência (Fluxoo)

Estrutura de menu (4 grupos + config):

- **Dashboard:** Painel, Painel FollowUP
- **Atendimentos:** Atendimentos, Respostas rápidas, Templates Meta, Kanban, Contatos, Agendamentos, Tags, Tarefas, Chat Interno
- **Automações:** Campanhas, Fluxos, Follow UP (Templates), Agente de IA, Integrações
- **Admin:** API, Usuários, Config. Aniversário, Filas & Chatbot, Lista de arquivos, Conexões, Gestor de Grupos, Financeiro
- **Extras no header:** Discador WhatsApp Plus (Voz + Msg), troca de tema, notificações, troca de conta (multi-conta), banner de renovação de assinatura

Rotas extraídas do bundle (`main.e740a671.js`), com descrição do que cada tela faz:

| Rota | Função observada |
|---|---|
| `/` | Painel/dashboard principal (403 no trial) |
| `/tickets/:ticketId?` | Atendimentos |
| `/quick-messages` | Respostas rápidas |
| `/template-manager` | **Templates Meta unificado**: templates + saúde do número + webhook Meta numa tela só, com contadores (total/aprovados/pendentes/rejeitados) |
| `/Kanban`, `/TagsKanban` | Kanban com filtros: SLA, atendente, fila, **canal (WhatsApp/Telegram/Facebook/Instagram)**, tag, ordenação por valor do ticket, data |
| `/kanban-boards` | **Múltiplos boards Kanban** ("Meus boards", criar board) |
| `/contacts`, `/contacts/import` | Contatos + importação |
| `/schedules` | Agendamentos |
| `/tags` | Tags |
| `/todolist` | Tarefas |
| `/chats/:id?` | Chat interno |
| `/moments` | Chats em tempo real |
| `/campaigns` | Campanhas com cards de status + importar CSV |
| `/campaign/:id/report` | Relatório de campanha |
| `/flowbuilders`, `/flowbuilder/:id?` | FlowBuilder com **importar .zip**, stats (ativos/pausados/rascunhos) |
| `/plugins/floup` | **Follow UP (templates de fluxo)**: passos, condição de ativação, parada automática ao responder |
| `/plugins/floup/dashboard` | Painel FollowUP: progresso dos fluxos, timeline por contato, enviados/respondidos |
| `/prompts` | **Agente de IA**: lista por fila, **métricas de uso de tokens** (entrada/saída/custo USD), máx tokens por resposta |
| `/queue-integration` | Integrações (projetos: typebot/n8n etc.) |
| `/messages-api` | **API Docs com playground**: 19 endpoints, testar endpoint na tela, histórico de requisições. Novidades marcadas: enviar imagem por URL, envio rápido sem ticket, envio em lote, mensagens interativas, verificar número, listar conexões |
| `/users` | Usuários |
| `/birthday-settings` | **Config. de aniversário**: notificação/modal de aniversário de usuários + informativo automático; **envio automático de WhatsApp de parabéns para contatos** com template `{nome}` |
| `/queues` | Filas & Chatbot |
| `/files` | Lista de arquivos |
| `/connections` | Conexões com ações: **Transferir Tickets, Reiniciar Conexões, Chamar Suporte** |
| `/group-manager` | **Gestor de Grupos**: sincronizar grupos do WhatsApp por conexão e gerenciar |
| `/financeiro`, `/financeiro-aberto` | Meu Plano: limites (usuários/conexões/filas/valor) + flags de features do plano (WhatsApp, Facebook, Instagram, Campanhas, Agendamentos, Chat Interno, API Externa, Kanban, OpenAI, Integrações, Fluxos, Contatos) |
| `/admin-financeiro` | Financeiro admin (SaaS) |
| `/companies` | Gestão de empresas (superadmin) |
| `/allConnections` | Todas as conexões (superadmin) |
| `/stack-status` | **Status da stack/infra** |
| `/wallets` | **Carteiras de contatos**: visão dedicada com totais, filtro por usuário, colunas contato/usuário/fila/telefone/email |
| `/account-switch` | **Troca de conta**: múltiplas contas/empresas salvas no login ("+ Adicionar conta", troca automática, indica "sem senha") |
| `/reports` | Relatórios (403 no trial) |
| `/closing-report` | **Relatório de fechamento**: protocolo, assunto, resumo, duração, tempo médio; exporta Excel/PDF |
| `/user-performance` | Desempenho por usuário |
| `/ads-report` | **Relatório de anúncios (CTWA)**: rastreia `ctwa_clid`, funil leads→atendimento→qualificados→vendas→perdidos, desempenho por anúncio |
| `/relatorio-vendas` | Relatório de vendas por período/atendente |
| `/call-report` | **Relatório de chamadas**: realizadas/recebidas/não atendidas/rejeitadas, por hora/dia, exporta CSV |
| `/wacalls/sessions` | **Discador WhatsApp Plus (Voz + Msg)**: microserviço de chamadas (whatsmeow), pareamento de número por sessão |
| `/whatsapp-health` | **Saúde dos números (API Oficial)**: quality rating, histórico, exporta PDF |
| `/meta-unified-webhook` | **Webhook unificado Meta**: 1 URL de callback + verify token, roteamento interno por `phone_number_id`, instruções passo a passo |
| `/google-calendar` | **Integração Google Agenda**: conectar conta Google p/ FlowBuilder criar eventos |
| `/webchat/:token` | **Webchat público** por token (widget/canal web) |
| `/helps` | Central de ajuda |
| `/announcements` | Informativos |
| `/validate-code` | **Verificação de e-mail por código no cadastro** |
| Configurações | Cards: Opções / **Google Agenda** / **Troncal SIP**; toggles gerais + seção **Inteligência Artificial** (auto-resumo IA ao finalizar, sugerir resposta com IA no chat) + Agendamento & Bot |

---

## 2. O que ELES têm e NÓS NÃO temos (gaps)

### Produto / canais
- **Telegram, Facebook e Instagram como canais** (aparecem no filtro do Kanban e nas flags do plano). Temos Instagram (login via API) parcial; sem Telegram/Facebook messenger como canal de ticket.
- **Webchat público `/webchat/:token`** — temos `WebChatAdapter` no backend e componente `WebChatWidget` órfão (não roteado); falta a página pública por token.
- **Discador WhatsApp Plus (Voz + Msg)** — `/wacalls/sessions` + `/call-report`. Microserviço separado (whatsmeow) para ligações. Temos só um `Softphone` SIP hardcoded/legado e sem Troncal SIP configurável nas settings.
- **Troncal SIP nas Configurações** — temos o componente Softphone com IP/senha fixos em código; eles têm tela de config.

### Gestão / produtividade
- **Múltiplos boards Kanban** (`/kanban-boards`) — nosso Kanban é board único (+TagsKanban).
- **Kanban com filtro de SLA e ordenação por valor** — nosso Kanban tem deals/valor; não vi filtro de SLA nem por canal.
- **Página dedicada de Carteiras** (`/wallets`) — temos `walletId` em contatos e filtros, mas não a visão de carteiras com totais por usuário/fila.
- **Troca de conta multi-empresa** (`/account-switch`) — login salva várias contas e troca sem logout.
- **Verificação de e-mail por código** (`/validate-code`) no cadastro.
- **Gestor de Grupos dedicado** (`/group-manager`) — temos `/groups`; verificar paridade (sincronização por conexão).
- **Config. de Aniversário** — informativo/modal de aniversário de usuários + **envio automático de mensagem de aniversário para contatos** via WhatsApp.
- **Relatório de fechamento** (`/closing-report`) — protocolo + assunto + resumo + duração + tempo médio, export Excel/PDF. Temos o modal de fechamento com assunto/resumo? (config "Tela de fechamento" existe nos dois); falta o relatório.
- **Relatório de vendas** e **desempenho por usuário** dedicados.
- **Relatório de anúncios (CTWA)** — atribuição click-to-WhatsApp → funil até venda. Não temos nada de ads.
- **Saúde dos números API Oficial** (`/whatsapp-health`) — temos `WhatsAppHealthCheckJob` no backend; falta a tela com histórico/PDF.
- **Webhook unificado Meta** (`/meta-unified-webhook`) — temos `meta-unified-webhook`? verificar backend; a tela assistida (callback URL + verify token + passo a passo) não existe.
- **Google Agenda integrado ao FlowBuilder** — temos só o asset svg.
- **Status da stack** (`/stack-status`).

### Plataforma / DX
- **API Docs com playground** — 19 endpoints documentados + testar + histórico. Nosso `/messages-api` é mais simples (verificar paridade de endpoints: eles têm envio rápido sem ticket, envio em lote, mensagens interativas, verificar número).
- **Importar fluxo .zip** no FlowBuilder.
- **Banner "plano vence em X dias" + Renovar** — SaaS billing integrado à UI (temos Subscription separado?).

### IA (eles têm mais simples, mas com algo que falta)
- **Métricas de tokens/custo por agente** na tela de prompts — nosso AIAgents não mostra custo USD/tokens por fila na listagem (verificar).

---

## 3. O que NÓS temos e ELES NÃO têm

- **Lead Scraper** (Google Maps + busca global com Puppeteer stealth) — diferencial forte.
- **Suíte de IA completa**: AIAgents, AITraining (treinamento, AB testing, knowledge base), AISettings — vs. `/prompts` simples deles.
- **Knowledge Base** dedicada.
- **Email Campaigns** — campanhas de e-mail.
- **Contact Lists** + itens + filtros avançados de contatos.
- **Phrase Lists** (listas de frases p/ campanha).
- **Campaigns New/Config + Detailed Report** — campanhas mais completas.
- **Follow-ups (drip sequences)** próprios — equivalente ao "floup" deles; comparar recursos (parada ao responder, painel de progresso deles é mais visual).
- **Console Admin unificado** (`/admin` com abas) vs. telas separadas deles (companies/allConnections/admin-financeiro).
- **Tutoriais /helps/* por feature** (20+ páginas).
- **Custom Fields admin**, **Roles/permissions dentro de /users**, **AuditLogs**.
- **TagsKanban** (eles também têm), **Moments** (idem), **QueueIntegration** (idem).
- **MetaTemplates** próprio (paridade com template-manager deles, mas eles unificam saúde+webhook na mesma tela).

---

## 4. Paridade (existe nos dois)

Dashboard, Tickets, Respostas rápidas, Templates Meta, Kanban, Contatos+import, Agendamentos, Tags, Tarefas, Chat interno, Campanhas+relatório, FlowBuilder, Integrações (queue-integration), API de mensagens, Usuários, Filas & Chatbot, Lista de arquivos, Conexões, Financeiro/Meu plano, Informativos, Ajuda, Chats tempo real, LGPD toggle, assinatura de atendente, saudação ao aceitar, posição na fila, mensagem de transferência, modal de fechamento com assunto/resumo, resumo/sugestão com IA.

---

## 5. Sugestão de priorização (gap → esforço)

| Prioridade | Item | Esforço | Status/Observação |
|---|---|---|---|
| ✅ | Transferir tickets entre conexões + guarda ao deletar | P | **Implementado 07/10/2026** (`TransferTicketsService`, `TransferTicketsModal`, guarda no delete) |
| ✅ | Modal de QR redesenhado (header verde, passos, countdown) | P | **Implementado 07/10/2026** (`QrcodeModal`) |
| ✅ | Relatório de fechamento | M | **Implementado 09/10/2026** (Onda 1): `GET /closing-report` + `/export` CSV, página `/closing-report`, migration `closingSubject`/`closingSummary` — modal de fechamento ainda não envia os campos (Onda 2) |
| ✅ | Webhook unificado Meta (tela) | P | **Implementado 10/10/2026** (Onda 2): `GET /meta-webhook-config` + página `/meta-unified-webhook` (URL, token mascarado, checklist de fields) |
| ✅ | Saúde dos números (tela) | M | **Implementado 10/10/2026** (Onda 2): `GET /whatsapp-health` on-demand na Graph API + página `/whatsapp-health`; histórico/cache pendente |
| Alta | Múltiplos boards Kanban | M-G | Modelo board→lanes; hoje é fixo |
| ✅ | Webchat público por token | M | **Implementado 11/10/2026** (Onda 3): `webchatToken` em Whatsapp + `/public/webchat/*` (rate-limited) + página `/webchat/:token` (poll 4s) |
| ✅ | Modal de msg interativa (botões/lista/PIX/URL) | M | **Implementado 10/10/2026** (Onda 2): `POST /messages/:ticketId/interactive` só WABA + `InteractiveMessageModal`; carrossel/catálogo/modelos salvos pendentes |
| Alta | WhatsApp Embedded Signup | M | Fluxo oficial da Meta; temos MetaOAuth já |
| Alta | Automação IG comentário→DM (trigger+like+follower+reward) | M-G | Diferencial ManyChat; precisa webhook IG comments |
| ✅ | Config. aniversário (envio WhatsApp) | M | **Implementado 11/10/2026** (Onda 3): `Contact.birthdate` + cron `handleBirthdayGreetings` 08:00 SP + seção em Settings + dedupe `lastBirthdayGreetingAt` |
| ✅ | Playground da API + novos endpoints | M | **Implementado 11/10/2026** (Onda 3): `/messages-api` virou playground — 36 endpoints testáveis, histórico de sessão, `getWhatsappsId` implementado |
| ✅ | Página de Carteiras | P-M | **Implementado 09/10/2026** (Onda 1): `GET /wallets` sobre tag `#` + `allowedContactTags`, página `/wallets` |
| Média | Multi-conta (account-switch) | M | Auth multi-tenant local |
| Média | Ads report (CTWA) | G | Capturar ctwa_clid no webhook Meta |
| ✅ | Kanban: filtro SLA + atalhos teclado + modo compacto | P-M | **Implementado 09/10/2026** (Onda 1): chip SLA usa `sessionWindowExpiresAt`+heurística 24h (campo SLA real pendente), atalhos ←/→/↑/↓/Enter/C/`/`, modo compacto |
| ✅ | Campanhas: recorrência + ações em lote + duplicar | M | **Implementado** (Ondas 1+3): bulk/duplicar + `recurrence` daily/weekly/monthly com `recurrenceEndAt` e claim atômico de reagendamento |
| ✅ | Verificação de e-mail por código no signup | M | **Implementado 10/10/2026** (Onda 2): tabela `EmailVerificationCodes` (hash+token uso único), `POST /auth/verify-email/*`, etapa de código no signup; fail-open sem SMTP |
| ✅ | Tela de fechamento (assunto/resumo) | M | **Implementado 10/10/2026** (Onda 2): setting `enableClosingForm` + modal no fechar ticket alimentando `/closing-report` |
| ✅ | SLA por fila | P | **Implementado 11/10/2026** (Onda 3): `Queue.slaMinutes` + filtro Kanban usa SLA real quando configurado |
| ✅ | Follow-up janela 24h (WABA) | M | **Implementado 11/10/2026** (Onda 4): enrollments viram `waiting_window` (re-check 30min, TTL 7d); templates Meta fora do gate |
| ✅ | Respostas rápidas: flags visão/edição | P | **Implementado 11/10/2026** (Onda 4): enforcement backend em `visao`/`geral` (colunas já existiam) + chips Pessoal/Global; corrigido bug de admin não editar resposta alheia |
| ✅ | Ramal interno (usuário) + CPF/CNPJ e código verificação (contato) | P | **Implementado 11/10/2026** (Onda 4): `Users.ramal` + `Contacts.verificationCode` (cpfCnpj já existia — pontas fechadas) |
| ✅ | Disparar fluxo num ticket | M | **Implementado 11/10/2026** (Onda 4): `POST /tickets/:id/trigger-flow` + `GET /tickets/:id/flows` + `TriggerFlowModal`; ticket vira `bot` |
| ✅ | Filtro de tickets por carteira | P | **Implementado 11/10/2026** (Onda 4): `walletUserIds` em `GET /tickets` + multi-select na aba de busca (admin) |
| ✅ | Nó Asaas boleto/PIX no FlowBuilder | M | **Implementado 14/10/2026** (Onda 5): `asaasCharge` — consulta CPF/CNPJ (OVERDUE+PENDING), envia boleto/linha digitável/PDF/PIX copia-e-cola+QR, saídas a/b. Env `ASAAS_API_KEY`/`ASAAS_BASE_URL` |
| ✅ | Google Agenda → FlowBuilder | M | **Implementado 14/10/2026** (Onda 5): `googleCalendar` — cria evento via Service Account (env `GOOGLE_CALENDAR_*`); OAuth por empresa pendente |
| 🟡 | Discador/WhatsApp calls (wacalls) | G | **Parcial 14/10/2026** (Onda 5): tabela `CallLogs` + `POST /call-logs` (X-Service-Token/`INTERNAL_SERVICE_TOKEN`) + relatório `/call-report`. Microserviço whatsmeow + WebRTC seguem fora |
| 🟡 | Telegram/Z-API como canais | G | **Telegram implementado 14/10/2026** (Onda 5): `telegram-setup` + webhook público `/public/telegram/:token`, inbound→ticket, outbound `sendMessage`. Mídia bidirecional e Z-API pendentes |
| ✅ | Troncal SIP nas settings + ramal no usuário | M | **Implementado 14/10/2026** (Onda 5): `CompaniesSettings.sip*` (senha mascarada `__set__`), `GET /companySipTrunk`, Softphone lê config real (hardcode removido). Servidor Asterisk/FreePBX é pré-requisito externo |
| ✅ | Multi-conta (account switch) | M | **Implementado 14/10/2026** (Onda 5): `GET /auth/switchable-accounts` + `POST /auth/switch` (vínculo por e-mail), item no menu do avatar |
| ✅ | Embedded Signup Meta | M | **Implementado 14/10/2026** (Onda 5): `POST /whatsapp/embedded-signup` + botão FB.login no WhatsAppModal. Precisa `REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID` |
| ✅ | Ads report CTWA | M | **Implementado 14/10/2026** (Onda 5): captura `referral.ctwa_clid` no webhook + `Ticket.ctwaClid/adId/adHeadline` + página `/ads-report` |
| ✅ | Automação IG comentário→DM (delta) | M | **Implementado 14/10/2026** (Onda 5): `autoLikeComment` (IG v26), `requireFollower` (`is_user_follow_business`, fail-open), `nonFollowerAction` skip/ask_follow, `rewardMediaUrl`. Permissão `instagram_manage_engagement` exige App Review |
| Verificar | Gestor de Grupos paridade | - | Comparar com nosso /groups |
| Alta restante | Multi-boards Kanban | G | Não iniciado — modelo board→lanes é refatoração grande |

---

## 6. Rodada 2 — achados via screenshots + análise do bundle

### 6.1 O que é o "WhatsApp Plus — Voz + Msg" (wacalls)

É um **microserviço separado** (sessão própria, "cada sessão consome uma conexão whatsmeow") que cria uma conexão WhatsApp capaz de **ligação de voz E vídeo dentro do browser**:

- Página `/wacalls/sessions`: parear número, listar sessões por JID/label
- O bundle tem **WebCodecs + MediaStream**: decoder/encoder de vídeo `avc1.42E01E` (H.264), eventos `call.incoming`, frames recebidos via WebSocket — ou seja, ligações WhatsApp (não oficiais, via protocolo whatsmeow) são **ponte para WebRTC no navegador**, incluindo vídeo
- Combina com o **Troncal SIP** (settings: host/porta/usuário/senha/domínio/transporte UDP/CallerID, status "SIP desconectado") — Asterisk/FreePBX para rotear ligações para ramais ("ramal interno" é campo do usuário deles)
- Relatório `/call-report`: realizadas/recebidas/não atendidas/rejeitadas por hora/dia + export CSV

**Como ter:** exige microserviço de chamadas baseado em whatsmeow (Go) com suporte a call events + bridge WebRTC no frontend. Não existe pacote pronto opensource com essa UX — é a peça de engenharia mais proprietária deles. Alternativa viável primeiro: Troncal SIP + softphone web (jssip) integrado ao ticket, que já temos embrionário (`components/Softphone`, hoje hardcoded).

### 6.2 Como funciona o Financeiro deles (SaaS self-service)

- `/financeiro` ("Meu Plano"): card do plano atual com limites (usuários, conexões, filas, valor R$), **chips de features** do plano (WhatsApp, Facebook, Instagram, Campanhas, Agendamentos, Chat Interno, API Externa, Kanban, OpenAI, Integrações, Fluxos, Contatos, Dashboard, Tempo Real, WhatsApp Oficial, **VoIP**, **Telegram**, **Z-API**, **WhatsApp Embedded Signup**)
- Barra de dias restantes ("Vence em dd/mm/aaaa — N dias restantes")
- Botão **"Pagamento Antecipado"** → checkout (provavelmente Asaas — existe nó de Asaas no FlowBuilder)
- **"Planos Disponíveis"**: marketplace de planos com card por plano (limites + chips + "Trocar Plano") — upgrade/downgrade self-service
- Banner persistente "plano vence em X dias" + CTA "Renovar agora" no topo de todas as telas
- `/admin-financeiro`: visão admin (faturas de todos os clientes); `/financeiro-aberto`: faturas em aberto

### 6.3 Conexões (detalhes não capturados antes)

- Layout em **cards** (não tabela): nome, ID, badge de status, **"Integridade"** (Estável/Instável), engine (**BAILEYS**), toggle Ativo
- Modal "Nova Conexão" lista: **WhatsApp, WhatsApp Plus — Voz + Msg, Webchat, Facebook, Instagram** (Telegram/Z-API via outras entradas)
- Ações do header: **Transferir Tickets** (modal origem→destino), Reiniciar Conexões, **Chamar Suporte**
- **WhatsApp Embedded Signup**: cadastro de número oficial direto no CRM (fluxo embedded da Meta, sem sair do painel)
- Modal de QR redesenhado: header verde com ícone, QR em card branco, **passos numerados**, countdown "QR Code atualiza em Ns"

### 6.4 Modal "Enviar Mensagem Interativa" (nos atendimentos)

Ícone na barra de input abre modal com **11 tipos**: Botões, Lista, Cobrança, Ofertas, PIX, URL, Ligação, Local, Carrossel, Catálogo, Enquete — com templates salvos ("Modelos"), rodapé opcional e **preview estilo WhatsApp** em tempo real.

### 6.5 FlowBuilder — nós que eles têm e nós não

- **Automação Instagram (estilo ManyChat)**: "Disparador: Comentário IG" (qualquer post ou palavras-chave), "Dar like no comentário" (auto-curtida), "É seguidor?" (2 saídas: segue → recompensa / não segue → DM "siga primeiro"), "Enviar recompensa" (arquivo PDF/imagem/vídeo no privado — isca digital)
- **"Segunda via boleto (Asaas)"**: pede CPF/CNPJ, valida, consulta Asaas e envia boletos; opções de entrega PIX (texto/imagem/ambos, variável `{{pixCopiaCola}}`, QR com legenda)
- **"Msg Interativa API"**: botões/lista na API oficial (máx 3)
- **TypeBot** (handoff para fluxo Typebot e retorno por palavra-chave), **n8n webhook**, **Randomizer**, **Trocar Fluxo**, **Input/Pergunta** com variável, If/Else com contains/regex, Menu Numérico, Intervalo
- Disparar fluxo manual num ticket: **TriggerFlowModal** ("Disparar Fluxo" — ticket vira status chatbot)

### 6.6 Outros detalhes

- **Kanban**: filtro "SLA Atrasado", modo Compacto/Expandido, **atalhos de teclado** (←/→ colunas, ↑/↓ cards, Enter abre, C compacto, / busca), boards com visibilidade compartilhado/privado + board padrão + templates de colunas
- **Campanhas**: recorrência (minuto→anual), **ações em lote** (cancelar/reiniciar/excluir selecionadas), duplicar, export CSV, preview da mensagem; na API oficial, **follow-up respeita janela de 24h** (msgs 2–5 só disparam após resposta do template)
- **Usuários**: campo "Ramal interno" (integra com SIP), botão "Gerar chats existentes"
- **Respostas rápidas**: flags por item "Permitir editar" / "Permitir visão" (globais vs. pessoais)
- **Contato**: campo CPF/CNPJ/Documento + **"Código de Verificação"** + "Receber Comentários" (notificação de comentários IG?)
- **Cadastro**: verificação de e-mail por código de 6 dígitos (`/validate-code`) antes de criar a conta
- **i18n**: pt/en/es/ar/tr (5 idiomas — incl. árabe RTL)

## 7. Notas de UX observadas no Fluxoo

- Sidebar agrupada em 5 categorias (Dashboard/Atendimentos/Automações/Admin/Configurações) vs. nossa lista mais plana.
- Banner persistente de expiração de plano com CTA "Renovar agora".
- Seção de IA dentro de Configurações (auto-resumo ao finalizar, sugerir resposta) — toggles simples que já temos distribuídos.
- Cards de status (totais) no topo de Campanhas, Fluxos, Templates, Conexões — padrão bento similar ao que adotamos.
- i18n em 5 idiomas (pt/en/es/ar/tr) — nós temos pt/en/es.
- "Chamar Suporte" na tela de conexões (abre ticket/chat direto com o provedor SaaS).
