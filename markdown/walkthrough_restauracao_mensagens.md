# Walkthrough: Restauração do Fluxo de Mensagens

Este documento detalha as correções aplicadas para resolver os problemas de entrega de mensagens, contatos duplicados e inconsistências no histórico, identificados após as mudanças de ~20 de janeiro de 2026.

## Alterações Realizadas

### 1. Rollback Parcial do `handleMessage`
**Arquivo:** `backend/src/services/WbotServices/wbotMessageListener.ts`
- **O que mudou:** Substituímos o bloco logicamente complexo que dependia exclusivamente do `ContactResolverService` pelo fluxo tradicional e robusto:
  1. `getContactMessage(msg)`: Extrai dados do contato
  2. `verifyContact(contact)`: Busca ou cria o contato (garantindo que se falhar, tenta novamente ou loga erro claro)
- **Por que:** O fluxo novo descartava silenciosamente mensagens quando a resolução de 3 camadas falhava. O fluxo antigo é linear e garante a criação do ticket.

### 2. Remoção de Estratégia de Risco (Busca por Nome Parcial)
**Arquivo:** `backend/src/services/ContactResolution/ContactResolverService.ts`
- **O que mudou:** A "Estratégia F" que buscava contatos usando `LIKE '%nome%'` foi removida.
- **Por que:** Essa estratégia causava bugs críticos onde mensagens de um novo contato ("Ana") eram atribuídas incorretamente a um contato antigo com nome similar ("Ana Paula"), violando a integridade dos dados.

### 3. Timeout no Mutex Global
**Arquivo:** `backend/src/services/WbotServices/wbotMessageListener.ts`
- **O que mudou:** Adicionado um `catch` com fallback no mutex que controla a criação de tickets.
- **Por que:** Se o processamento travasse (deadlock), todas as mensagens da empresa paravam de chegar. Agora, após 5 segundos (timeout padrão da lib ou erro), o sistema processa a mensagem mesmo sem o lock, evitando paralisia total.

## Como Verificar as Correções

Recomendamos realizar os seguintes testes manuais para confirmar a estabilidade:

### Teste 1: Fluxo Básico de Recebimento
1. Envie uma mensagem de um número **externo** (que já tenha contato no sistema) para o WhatsApp conectado.
2. **Resultado esperado:** A mensagem deve aparecer imediatamente no ticket aberto ou criar um novo ticket. Verifique se caiu no contato correto.

### Teste 2: Recebimento de Novo Contato
1. Envie uma mensagem de um número **nunca antes cadastrado**.
2. **Resultado esperado:**
   - O contato deve ser criado com o número correto (ex: `5511999999999`).
   - **NÃO** deve ser criado como `PENDING_xxxx`.
   - O ticket deve ser aberto normalmente.

### Teste 3: Mensagem Enviada pelo Celular (Sincronização)
1. No aparelho celular, envie uma mensagem para qualquer contato.
2. **Resultado esperado:** A mensagem deve aparecer no painel do Whaticket (sincronização via `fromMe`). Verifique se ela foi atribuída ao ticket correto.

### Teste 4: Grupos
1. Envie uma mensagem em um grupo onde o Whaticket está presente.
2. **Resultado esperado:** A mensagem deve entrar no ticket do grupo. Se for de um participante desconhecido, o sistema deve criar o participante ou usar o nome do pushName, sem descartar a mensagem.

## Monitoramento
Fique atento aos logs do backend (`pm2 logs backend`). Mensagens de erro como `[handleMessage] ERRO CRÍTICO: Contato não encontrado` indicarão falhas que antes eram silenciosas, permitindo diagnóstico rápido.
