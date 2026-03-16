# Guia de Permissões - IA e Agendamento

## 🤖 Recursos de Inteligência Artificial

### Permissões Disponíveis

O sistema possui **3 permissões principais** para recursos de IA:

#### 1. **Acessar Training / Sandbox (IA)** → `ai-training.view`
**Libera:**
- ✅ Assistente de Prompt (reescrever, sugerir melhorias)
- ✅ Cenários de Teste
- ✅ Sandbox de Treinamento
- ✅ Feedback e Métricas
- ✅ Versionamento de Prompts
- ✅ Comparação A/B de prompts
- ✅ Estatísticas de treinamento

**Endpoints protegidos:**
- `/ai/prompt-assistant/*`
- `/ai/test-scenarios/*`
- `/ai/sandbox/*`
- `/ai/training/*`
- `/ai/prompt-versions/*`

---

#### 2. **Ver Config. IA** → `ai-settings.view`
**Libera:**
- ✅ Geração de mensagens de campanha
- ✅ Transformação de texto
- ✅ Listagem de modelos IA
- ✅ Visualizar presets de IA
- ✅ Orquestrador de IA
- ✅ Estatísticas de uso

**Endpoints protegidos:**
- `/ai/generate-campaign-messages`
- `/ai/transform`
- `/ai/models`
- `/ai/presets`
- `/ai/orchestrator/*`

---

#### 3. **Ver Chat Interno** → `internal-chat.view`
**Libera:**
- ✅ Chat interno entre usuários
- ✅ Enviar mensagens internas
- ✅ Visualizar conversas internas
- ✅ Criar grupos de chat

**Endpoints protegidos:**
- `/chats/*`

---

## 📅 Agendamento de Mensagens

### Permissões para Agendamento

#### 1. **Ver Agendamentos** → `schedules.view`
- Visualizar lista de agendamentos
- Ver detalhes de agendamento

#### 2. **Criar Agendamentos** → `schedules.create`
- Criar novos agendamentos
- Upload de arquivos

#### 3. **Editar Agendamentos** → `schedules.edit`
- Modificar agendamentos existentes
- Upload/remoção de mídias

#### 4. **Deletar Agendamentos** → `schedules.delete`
- Remover agendamentos

**Endpoints protegidos:**
- `/schedules/*`
- `/schedules-message/*`

---

## 🎯 Como Habilitar Recursos de IA (Checkbox Único)

Para liberar **TODOS** os recursos de IA para um usuário:

### Via Interface (Recomendado):

1. Acesse **Configurações > Usuários**
2. Clique em **Editar** no usuário desejado
3. Vá para aba **Permissões**
4. Na categoria **Inteligência Artificial**, marque:
   - ✅ **Acessar Training / Sandbox (IA)**
   - ✅ **Ver Config. IA**
   - ✅ **Editar Config. IA** (opcional, para admins)
   - ✅ **Ver Base de Conhecimento** (se usar RAG)
5. Na categoria **Módulos**, marque:
   - ✅ **Ver Chat Interno** (se usar chat interno)
6. Clique em **Salvar**

---

## 🎯 Como Habilitar Agendamento de Mensagens

### Via Interface:

1. Acesse **Configurações > Usuários**
2. Clique em **Editar** no usuário desejado
3. Vá para aba **Permissões**
4. Na categoria **Módulos**, marque:
   - ✅ **Ver Agendamentos**
   - ✅ **Criar Agendamentos**
   - ✅ **Editar Agendamentos**
   - ✅ **Deletar Agendamentos** (opcional)
5. Clique em **Salvar**

---

## ✅ Tratamento de Erros 403

### Recursos de IA
Os recursos de IA **já possuem tratamento silencioso de 403**. Se o usuário não tiver permissão:
- ❌ **NÃO** exibe erro visual
- ❌ **NÃO** exibe toast de erro
- ✅ Funcionalidades de IA ficam desabilitadas
- ✅ Sistema continua funcionando normalmente

**Arquivos protegidos:**
- `frontend/src/services/aiTraining.js` - Serviços retornam erro que pode ser tratado
- Componentes que usam IA devem ter try/catch com verificação 403

---

### Agendamento de Mensagens
O agendamento **já possui tratamento silencioso de 403**.

**Arquivo:** `frontend/src/pages/Schedules/index.js`
- Linhas 185-189: Listagem silencia 403
- Linhas 269-273: Deleção silencia 403

---

## 🔍 Troubleshooting

### Erro 403 ao usar assistente de IA

**Causa:** Usuário sem permissão `ai-training.view`

**Solução:**
1. Verificar se usuário tem checkbox **"Acessar Training / Sandbox (IA)"** marcado
2. Se não tiver, marcar e salvar
3. Recarregar página (F5)

---

### Erro 403 ao acessar agendamentos

**Causa:** Usuário sem permissão `schedules.view`

**Solução:**
1. Verificar se usuário tem checkbox **"Ver Agendamentos"** marcado
2. Se não tiver, marcar e salvar
3. Recarregar página (F5)

---

### Erro 403 ao usar chat interno

**Causa:** Usuário sem permissão `internal-chat.view`

**Solução:**
1. Verificar se usuário tem checkbox **"Ver Chat Interno"** marcado
2. Se não tiver, marcar e salvar
3. Recarregar página (F5)

---

## 📊 Tabela Resumida de Permissões

| Recurso | Permissão Principal | Usuário Comum Tem? | Admin Tem? |
|---------|-------------------|-------------------|------------|
| **Assistente de IA** | `ai-training.view` | ❌ Não (opcional) | ✅ Sim |
| **Config. IA** | `ai-settings.view` | ❌ Não | ✅ Sim |
| **Chat Interno** | `internal-chat.view` | ❌ Não (opcional) | ✅ Sim |
| **Agendamentos** | `schedules.view` | ❌ Não (opcional) | ✅ Sim |
| **Criar Agendamento** | `schedules.create` | ❌ Não | ✅ Sim |
| **Editar Agendamento** | `schedules.edit` | ❌ Não | ✅ Sim |
| **Deletar Agendamento** | `schedules.delete` | ❌ Não | ✅ Sim |

---

## 🚀 Permissões Recomendadas por Perfil

### Usuário Comum (Atendente)
```
✅ tickets.view
✅ tickets.update
✅ tickets.create
✅ quick-messages.view
✅ contacts.view
✅ tags.view
✅ helps.view
```

### Supervisor/Gestor
```
✅ (Todas do Usuário Comum)
✅ tickets.transfer
✅ tickets.close
✅ dashboard.view
✅ reports.view
✅ schedules.view
✅ schedules.create
```

### Administrador
```
✅ (Todas)
```

### Desenvolvedor/Treinador de IA
```
✅ (Todas do Usuário Comum)
✅ ai-training.view
✅ ai-settings.view
✅ prompts.view
✅ prompts.edit
✅ ai-agents.view
✅ ai-agents.edit
```

---

## 📝 Notas Importantes

### IA não é obrigatória
- Sistema funciona perfeitamente sem IA
- IA é um módulo **opcional** que pode ser ativado por permissões
- Usuários sem permissão não veem funcionalidades de IA

### Agendamento é opcional
- Sistema funciona sem agendamento
- Menu de agendamento só aparece para quem tem permissão
- Sem erro 403 na interface se não tiver permissão

### Chat Interno é opcional
- Sistema funciona sem chat interno
- Recurso para comunicação entre usuários
- Não afeta atendimento via WhatsApp

---

## 📂 Arquivos Relacionados

### Backend
- `backend/src/routes/aiRoutes.ts` - Rotas de IA com checkPermission
- `backend/src/routes/chatRoutes.ts` - Rotas de chat interno
- `backend/src/routes/scheduleRoutes.ts` - Rotas de agendamento
- `backend/src/routes/ScheduledMessagesRoutes.ts` - Mensagens agendadas
- `backend/src/helpers/PermissionAdapter.ts` - Definição de permissões

### Frontend
- `frontend/src/services/aiTraining.js` - Serviços de IA
- `frontend/src/pages/Schedules/index.js` - Agendamentos (com tratamento 403)
- `frontend/src/pages/Chat/index.js` - Chat interno
- `frontend/src/pages/AITraining/index.js` - Training/Sandbox

---

## ✅ Checklist de Configuração

Para habilitar **IA completa** para um usuário:

- [ ] `ai-training.view` - Acessar Training / Sandbox (IA)
- [ ] `ai-settings.view` - Ver Config. IA
- [ ] `ai-settings.edit` - Editar Config. IA (opcional)
- [ ] `prompts.view` - Ver Prompts
- [ ] `prompts.edit` - Editar Prompts
- [ ] `ai-agents.view` - Ver Agentes de IA
- [ ] `ai-agents.edit` - Editar Agentes de IA
- [ ] `files.view` - Ver Base de Conhecimento (RAG)
- [ ] `internal-chat.view` - Ver Chat Interno (opcional)

Para habilitar **Agendamento** para um usuário:

- [ ] `schedules.view` - Ver Agendamentos
- [ ] `schedules.create` - Criar Agendamentos
- [ ] `schedules.edit` - Editar Agendamentos
- [ ] `schedules.delete` - Deletar Agendamentos (opcional)

---

**Data:** 2026-03-16  
**Versão:** 1.0
