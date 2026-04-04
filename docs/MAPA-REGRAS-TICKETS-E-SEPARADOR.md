# Mapa de regras de tickets e separador do chat

## Objetivo deste mapa

Este documento consolida:

1. Onde o sistema decide criar, reabrir ou reutilizar tickets.
2. Onde o frontend decide mostrar o separador de ticket no histórico unificado.
3. Quais pontos hoje seguem uma regra central e quais abrem ticket por fora.
4. Como a regra desejada deve funcionar usando conexão + expediente do atendente.

---

## 1. Como o separador aparece no chat hoje

### Histórico unificado

O backend não retorna apenas as mensagens do ticket atual.

Ele unifica o histórico no `ListMessagesService`:

- Contato normal: junta mensagens apenas dos tickets do mesmo `contactId` e mesma `whatsappId`.
- Grupo: junta mensagens de todos os tickets do mesmo grupo.

Isso explica por que o chat mostra todo o histórico mesmo quando existem vários tickets.

### Regra atual do separador

No frontend, o separador é renderizado quando:

- a mensagem atual tem `ticketId` diferente da mensagem anterior.

Ou seja:

- o separador não sabe se a criação do ticket foi correta;
- ele apenas reage ao fato de existir mudança de `ticketId` no histórico unificado.

### Dados exibidos no separador

Hoje o separador mostra:

- `#ticketId`
- fila do ticket
- nome do atendente
- data/hora do `ticket.createdAt`

Consequência:

- se um ticket extra for criado no banco, o separador aparece;
- a data do separador pode parecer “errada”, porque ele usa a criação do ticket e não a primeira mensagem daquele bloco;
- o nome do atendente pode parecer inconsistente quando o frontend usa fallback para o usuário logado.

---

## 2. Regra central atual de criação/reuso de ticket

### Serviço principal

O núcleo atual está em `FindOrCreateTicketService`.

Quase todos os fluxos importantes convergem para ele.

### 2.1. Casos especiais

#### Self-chat

- Sempre reutiliza o mesmo ticket determinístico por UUID.

#### Grupo

- Grupo tende a ser 1 grupo = 1 ticket.
- Se existir ticket antigo do grupo, ele é reutilizado.
- Se estiver fechado ou em status inadequado, volta para `group`.

### 2.2. Contato comum

Para contatos normais, o serviço:

1. Busca o ticket mais recente por `contactId + companyId + whatsappId + isGroup=false`.
2. Não filtra por status nessa busca inicial.

Se encontrou um ticket:

#### Campanha

- Se existir ticket ativo na mesma conexão, ele pode ser reaproveitado.
- Se o último ticket da conexão estiver fechado, a tendência é abrir novo ciclo.

#### Ticket está `closed`

Se o ticket encontrado está `closed`, a decisão correta é:

1. Identificar o último usuário responsável pelo ciclo.
2. Ler o expediente desse usuário.
3. Verificar se a nova interação caiu dentro do mesmo expediente.

Se caiu no mesmo expediente:

- mesmo usuário + mesma conexão = reabre o mesmo ticket.

Se não caiu:

- cria novo ticket.

#### Ticket encontrado continua válido

Se o ticket continua válido:

- atualiza `unreadMessages`;
- em alguns casos muda `pending -> bot`;
- se ainda está ativo (`open`, `pending`, `bot`, `campaign`, `lgpd`, `nps`), tende a continuar no mesmo ciclo;
- se `userId` ou `queueId` da chamada entrarem em conflito com o ticket encontrado, o serviço lança erro.

### 2.3. Quando cria ticket novo

Se nenhum ticket foi reaproveitado, cria um novo com status inicial calculado por contexto:

- `lgpd`
- `group`
- `bot`
- `pending`

O status inicial depende de:

- LGPD,
- grupo,
- existência de fila padrão,
- chatbot/AI agent,
- flags como `isImported`, `isCampaign` e `isFromMe`.

---

## 3. Problema estrutural da regra atual

O comportamento desejado de negócio é diferente:

- a conversa precisa ser separada por conexão;
- grupo precisa continuar em ticket único;
- a janela precisa respeitar o expediente do atendente;
- e a virada real de ciclo deve acontecer principalmente quando o ticket foi fechado.

### Exemplo do comportamento desejado

Se o atendente A trabalha de 07:00 a 17:00:

- mensagem às 08:00 de hoje -> ticket A
- fechamento às 12:00
- nova mensagem às 14:00 de hoje -> mantém o mesmo ticket A
- nova mensagem amanhã às 09:00 -> novo ticket

Ou seja:

- a fronteira deve ser o expediente/dia de trabalho do atendente, não 24h corridas.

Se o mesmo contato falar por outra conexão:

- o histórico deve ficar separado;
- e a mesma lógica de expediente deve ser aplicada naquela conexão.

---

## 4. Onde a regra atual já está espalhada ou quebrada

Além do serviço principal, existem fluxos paralelos que criam ou reabrem ticket fora da mesma regra.

Isso hoje é uma das causas mais prováveis de ticket extra e separador aparecendo “na hora errada”.

### 4.1. Entradas que usam o serviço principal

Usam `FindOrCreateTicketService`:

- recebimento Baileys/WhatsApp
- webhook da API oficial
- Facebook/Instagram
- importação de histórico
- envio/abertura por API
- encaminhamento manual
- transferência com `closeTicketOnTransfer`
- campanhas em parte do fluxo

### 4.2. Fluxos que criam ticket por fora

#### Criação manual

`CreateTicketService`:

- era um dos pontos de criação paralela;
- precisa seguir a mesma lógica de contato + conexão + expediente;
- grupo continua reaproveitando o mesmo ticket lógico.

#### Envio de template oficial

`SendTemplateToContact`:

- se houver ticket `open` ou `pending`, reutiliza;
- se não houver, chama `CreateTicketService`;
- portanto não segue a regra do serviço principal.

#### Agendamento

No `queues.ts`, quando `openTicket === "enabled"`:

- precisa seguir a mesma regra central;
- não deve criar ticket direto ignorando conexão e expediente.

Também não segue a regra principal.

#### Chamada perdida

No `wbotMonitor`:

- não deve abrir ticket por regra própria;
- precisa respeitar a mesma decisão central do restante do atendimento.

#### Sincronização de grupos

No `SyncAllGroupsService`:

- cria ticket de grupo diretamente se não existir.

#### Transferência com fechamento automático

No `UpdateTicketService`, com `closeTicketOnTransfer=true`:

- fecha o ticket antigo;
- chama `FindOrCreateTicketService` para outro ticket;
- migra mensagens do ticket antigo para o novo.

Isso impacta diretamente a leitura do histórico e do separador.

---

## 5. Pontos de conflito que explicam o bug percebido

### Conflito A: vários criadores de ticket

Não existe hoje um único “motor” de decisão obrigatório para todos os fluxos.

Existe:

- uma regra central;
- vários atalhos laterais.

Resultado:

- o sistema não tem padrão único de abertura/reabertura;
- o histórico unificado acaba mostrando essa inconsistência.

### Conflito B: saída manual pode cair na regra errada

Historicamente havia fluxos de encaminhamento e envio que chamavam `FindOrCreateTicketService` sem marcar explicitamente `isFromMe=true`.

Consequência:

- uma ação do atendente pode cair na lógica pensada para mensagem recebida;
- isso pode disparar criação indevida de ticket novo.

### Conflito C: campo `timeCreateNewTicket`

O campo `whatsapp.timeCreateNewTicket` existe no sistema e aparece em telas/configuração.

Mas, no fluxo principal atual:

- ele não define a regra ativa de criação/reabertura.

Hoje ele aparece em código legado ou alternativo, não no caminho principal usado pelo atendimento padrão.

### Conflito D: expediente do usuário precisa ser a fonte oficial da janela

Os campos do usuário existem:

- `startWork`
- `endWork`

Eles aparecem no modal do usuário e em serviços de autenticação/status.

Regra correta:

- eles devem definir a reutilização de ticket fechado para o mesmo atendente no mesmo expediente.

---

## 6. Regra alvo proposta

### Princípio

O ticket deve representar um ciclo de atendimento rastreável por conexão.

O chat continua unificado, mas o ticket deve separar claramente:

- qual atendente conduziu aquele ciclo;
- em qual conexão esse ciclo aconteceu;
- em qual expediente esse ciclo aconteceu.

### Regra alvo para contato normal

Ao chegar uma nova interação para um contato:

1. Buscar o último ticket rastreável daquele contato naquela conexão/canal.
2. Descobrir quem foi o último atendente responsável pelo ciclo.
3. Descobrir qual era o expediente desse atendente.
4. Verificar se a nova interação caiu dentro do mesmo expediente daquele atendente.

Se sim:

- mesmo contato
- mesma conexão/canal
- mesmo atendente
- mesma janela de expediente

Resultado:

- reutiliza/reabre o mesmo ticket.

Se não:

- cria novo ticket.

### Regra alvo para grupos

Para grupos:

- não existe rotação por expediente;
- o mesmo grupo deve continuar no mesmo ticket lógico;
- duplicidade de ticket em grupo deve ser tratada como exceção técnica, não como regra.

### Regra prática do exemplo desejado

Usuário trabalha de `07:00` a `17:00`.

Hoje:

- 08:00 -> cria ticket
- 12:00 -> fecha ticket
- 14:00 -> reabre/reutiliza o mesmo ticket

Amanhã:

- 09:00 -> cria novo ticket

### Observação importante

Essa regra é melhor modelada como:

- “mesmo expediente do atendente”

e não como:

- “últimas 24 horas”.

---

## 7. Padrão recomendado para refatoração

### 7.1. Criar uma única regra canônica

Todo fluxo que precise abrir ou reutilizar ticket deveria passar por um único resolvedor de decisão, por exemplo:

- `ResolveTicketLifecycleService`

Esse resolvedor receberia:

- contato
- conexão/canal
- usuário responsável, quando existir
- origem do evento (`incoming`, `manual_send`, `forward`, `campaign`, `schedule`, `template`, `transfer`, etc.)
- data/hora da interação

E devolveria:

- `reuse`
- `reopen`
- `create_new`

com justificativa explícita.

### 7.2. Regra base recomendada

Para contato normal:

1. localizar o último ticket do contato naquele canal/conexão;
2. identificar o responsável do último ciclo;
3. calcular a janela do expediente daquele responsável na data do último ciclo;
4. se a nova interação pertence à mesma janela e ao mesmo usuário, reutilizar/reabrir;
5. se mudou o dia de expediente, criar novo ticket;
6. se mudou o atendente, criar novo ticket;
7. se mudou a conexão, criar outro ciclo separado;
8. se a origem for campanha/sistema e não houver um ticket ativo compatível, criar novo ticket separado.

### 7.3. Separador do chat

O separador pode continuar baseado em mudança de `ticketId`.

Mas o ideal é ajustar a exibição:

- usar o primeiro timestamp do bloco daquele ticket, não `ticket.createdAt`;
- usar o atendente real do ticket, sem fallback para o usuário logado;
- opcionalmente exibir o motivo do ciclo: atendimento, campanha, transferência, reabertura.

---

## 8. Como entendi a decisão de negócio

O que o produto quer não é apenas “evitar duplicar ticket”.

O que o produto quer é:

- manter o histórico completo unificado no chat;
- dividir esse histórico em ciclos rastreáveis;
- garantir que cada ciclo represente um atendimento coerente;
- permitir responder depois: quem atendeu, quando atendeu e em qual contexto aquele ticket existiu.

Em termos de negócio:

- mesmo atendente no mesmo expediente e na mesma conexão = mesmo ticket;
- mesmo atendente em expediente seguinte = novo ticket;
- atendente diferente = novo ticket;
- conexão diferente = outro histórico/ticket;
- histórico continua unido, mas o separador passa a refletir ciclos reais de atendimento.

---

## 9. Próxima etapa sugerida

Antes de mexer no código, o ideal é fechar uma especificação final com três decisões:

1. Qual usuário define a janela quando a mensagem entra sem `userId`.
2. Como tratar campanhas, templates e agendamentos dentro da nova regra.
3. Se transferências devem criar novo ticket sempre ou apenas quando muda o atendente/fila.

Com isso fechado, a implementação pode ser feita com menos risco e sem espalhar mais exceções.
