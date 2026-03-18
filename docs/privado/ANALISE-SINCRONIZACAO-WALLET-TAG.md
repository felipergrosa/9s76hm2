# Análise: Sincronização Automática Carteira ↔ Tag Pessoal

## Objetivo
Estudar viabilidade técnica de sincronizar automaticamente a carteira (wallet) do usuário com a tag pessoal selecionada.

**Exemplo:**
- Usuário Bruna tem wallet "bruna"
- Admin seleciona tag `#BRUNA-ZANOBIO` no campo "Tags Pessoais"
- Sistema automaticamente vincula wallet "bruna" ↔ tag `#BRUNA-ZANOBIO`
- Em qualquer lugar onde preencher a carteira, já preenche automaticamente a tag sincronizada

---

## Modo: N0 (Estudo/Exploração)

---

## 🔍 Arquitetura Atual

### Conceitos Principais

| Conceito | Definição | Onde é usado |
|----------|-----------|--------------|
| **Wallet** | Associação direta User ↔ Contact via tabela `ContactWallet` | Filtro de contatos, atribuição de tickets |
| **Tag Pessoal** | Tag que começa com `#` (ex: `#BRUNA-ZANOBIO`) | Filtro de contatos, permissões de visualização |
| **Carteira** | Sinônimo de Wallet + Tags Pessoais combinadas | `GetUserWalletContactIds` usa ambos |

### Estrutura de Dados

#### 1. Tabela `ContactWallet` (Wallet)
```typescript
{
  id: number,
  contactId: number,  // FK para Contact
  walletId: number,   // FK para User (quem é a carteira)
  companyId: number
}
```

**Funcionamento:**
- Um contato pode ter múltiplas wallets (ex: Bruna + Allan)
- Uma wallet (User) pode ter múltiplos contatos
- Relação N:N via tabela intermediária

#### 2. Campo `User.allowedContactTags` (Tags Pessoais)
```typescript
{
  allowedContactTags: number[]  // Array de IDs de tags
}
```

**Funcionamento:**
- Tags que começam com `#` são consideradas "pessoais"
- Usuário pode ter múltiplas tags pessoais
- `GetUserWalletContactIds` filtra apenas tags `#`

#### 3. Tabela `ContactTag` (Vínculo Contato-Tag)
```typescript
{
  id: number,
  contactId: number,
  tagId: number
}
```

---

## 📊 Como Funciona Hoje

### Fluxo de Permissões (GetUserWalletContactIds)

```
1. Buscar usuário → allowedContactTags (array de IDs)
2. Buscar tags na tabela Tag → filtrar apenas que começam com "#"
3. Buscar ContactTag → contatos que têm essas tags
4. Retornar contactIds (carteira do usuário)
```

### Onde Wallet é usada:

1. **ListContactsService** - Filtra contatos por wallet
2. **SimpleListService** - Filtra contatos por wallet
3. **ListTicketsService** - Filtra tickets por wallet do contato
4. **ListTicketsServiceKanban** - Filtra tickets por wallet
5. **UpdateTicketService** - Verifica permissão de assumir ticket
6. **CheckContactOpenTickets** - Verifica permissão baseada em wallet
7. **Atribuição de Ticket** - Verifica se contato está na carteira do usuário

### Onde Tag Pessoal é usada:

1. **GetUserWalletContactIds** - Converte tags `#` em carteira
2. **Atribuição de Contato** - Adiciona tags ao contato
3. **Criação de Ticket** - Verifica se contato tem tag do usuário

---

## 🎯 Proposta de Sincronização

### Opção 1: Campo Virtual/Calculado (Recomendada)

**Ideia:** Criar campo `walletTagId` na tabela User que armazena o ID da tag sincronizada.

```typescript
// Model User
@Column
walletTagId: number;  // ID da tag pessoal vinculada

// Virtual getter
get walletTagName(): string {
  // Retorna nome da tag baseado no walletTagId
}
```

**Lógica:**
```typescript
// Quando admin atualiza allowedContactTags
if (userData.allowedContactTags?.length > 0) {
  // Pegar primeira tag pessoal (#) e sincronizar como walletTagId
  const personalTag = await Tag.findOne({
    where: {
      id: { [Op.in]: userData.allowedContactTags },
      name: { [Op.like]: "#%" }
    },
    order: [["name", "ASC"]]  // Ou alguma outra lógica de prioridade
  });
  
  if (personalTag) {
    user.walletTagId = personalTag.id;
  }
}
```

**Impacto nos Serviços:**

1. **GetUserWalletContactIds** (linha 86-105)
   - Atualmente: `userTags = allowedContactTags`
   - Com sync: `userTags = [walletTagId, ...outrasTags]`
   - Prioriza a tag sincronizada

2. **UpdateUserService**
   - Adicionar lógica de sync ao atualizar `allowedContactTags`

3. **CreateUserService**
   - Adicionar lógica de sync ao criar usuário

4. **Frontend - UserModal**
   - Campo "Tags Pessoais" vira dropdown único (selecionar apenas 1)
   - Ou mantém múltiplo mas destaca a "principal"

### Opção 2: Convensão de Nome (Nome = Tag)

**Ideia:** A wallet do usuário sempre tem o mesmo nome que a tag pessoal.

```typescript
// Ex: Usuário Bruna
user.name = "Bruna"  // ou "BRUNA-ZANOBIO"
tag.name = "#BRUNA-ZANOBIO"  // sempre com #
```

**Problema:** Não é flexível - usuário pode ter nome diferente da tag.

### Opção 3: Trigger Automático no Banco

**Ideia:** Trigger PostgreSQL que mantém sync entre Wallet e Tag.

**Problema:** Complexidade alta, dificulta manutenção.

---

## 📍 Locais que Precisariam de Alteração

### Backend

| Arquivo | Alteração | Complexidade |
|---------|-----------|--------------|
| `models/User.ts` | Adicionar `walletTagId` | Baixa |
| `services/UserServices/UpdateUserService.ts` | Lógica de sync ao atualizar | Média |
| `services/UserServices/CreateUserService.ts` | Lógica de sync ao criar | Média |
| `helpers/GetUserWalletContactIds.ts` | Priorizar tag sincronizada | Média |
| `database/migrations/xxx_add_walletTagId.ts` | Migration de banco | Baixa |

### Frontend

| Componente | Alteração | Complexidade |
|--------------|-----------|--------------|
| `components/UserModal/index.js` | Destacar tag sincronizada | Média |
| `pages/Users/index.js` | Mostrar vínculo wallet-tag | Baixa |
| `components/TagModal/index.js` | Indicar quais tags são wallets | Baixa |

---

## ✅ Prós (Benefícios)

### 1. **UX Simplificada**
- Admin configura uma vez: seleciona tag pessoal → wallet automaticamente vinculada
- Reduz erros de configuração

### 2. **Consistência de Dados**
- Garante que wallet e tag estejam sempre alinhadas
- Evita situações onde contato está na wallet mas não tem a tag

### 3. **Performance**
- `GetUserWalletContactIds` pode priorizar a tag sincronizada (cache mais eficiente)
- Reduz queries complexas de junção

### 4. **Manutenção**
- Centraliza lógica de "carteira principal" do usuário
- Facilita auditoria e debugging

### 5. **Flexibilidade**
- Usuário pode ter múltiplas tags, mas uma é a "principal" (sincronizada)
- Admin pode trocar a tag sincronizada a qualquer momento

---

## ❌ Contras (Riscos)

### 1. **Complexidade de Migração**
- Dados existentes precisam ser migrados
- Usuários sem tag pessoal precisam de tratamento especial

### 2. **Restrição de Flexibilidade**
- Hoje: usuário pode ter múltiplas wallets (ex: Bruna + Representante)
- Com sync: pode confundir se só uma é a "principal"

### 3. **Edge Cases**
```
Cenário Problemático:
- Bruna tem tag #BRUNA-ZANOBIO (sincronizada)
- Bruna também tem tag #REPRESENTANTES
- Contato tem apenas #REPRESENTANTES
- Quem vê esse contato? (Bruna via tag ou não?)
```

### 4. **Impacto em Recursos Existentes**
- Todos os serviços que usam `GetUserWalletContactIds` precisam ser revisados
- Potencial para bugs de regressão

### 5. **Admin Experience**
- Se limitar a 1 tag pessoal: perde flexibilidade
- Se permitir múltiplas: qual é a "sincronizada"?

---

## 🎨 Interface Proposta

### Opção A: Dropdown Único (1 tag pessoal)

```
┌─────────────────────────────────────────┐
│  Tags Pessoais (Carteira)               │
│  ┌──────────────────────────────────┐   │
│  │ [#BRUNA-ZANOBIO]  ▼               │   │  ← Seleciona 1
│  └──────────────────────────────────┘   │
│                                         │
│  ℹ️ Esta tag define sua carteira         │
│     de contatos automaticamente          │
└─────────────────────────────────────────┘
```

### Opção B: Múltiplo com Destaque

```
┌─────────────────────────────────────────┐
│  Tags Pessoais (Carteiras)              │
│  ┌──────────────────────────────────┐   │
│  │ ★ #BRUNA-ZANOBIO  ✓ (principal)   │   │  ← Sincronizada
│  │   #REPRESENTANTES                │   │  ← Secundária
│  └──────────────────────────────────┘   │
│                                         │
│  [+ Adicionar Tag]                      │
└─────────────────────────────────────────┘
```

---

## 🧮 Estimativa de Esforço

### Implementação Completa (Opção 1 - Recomendada)

| Tarefa | Tempo Estimado |
|--------|----------------|
| Migration de banco | 30 min |
| Alteração Model User | 30 min |
| UpdateUserService | 1-2 horas |
| CreateUserService | 1 hora |
| GetUserWalletContactIds | 1-2 horas |
| Testes backend | 2-3 horas |
| Frontend UserModal | 2-3 horas |
| Testes integração | 2 horas |
| **TOTAL** | **12-16 horas** |

---

## 🚀 Plano de Implementação (se aprovado)

### Fase 1: Preparação
1. Migration adicionar `walletTagId` na tabela `users`
2. Script de migração de dados existentes

### Fase 2: Backend
1. Atualizar Model User com campo novo
2. Modificar UpdateUserService para sincronização
3. Modificar CreateUserService para sincronização
4. Atualizar GetUserWalletContactIds para priorizar tag sync
5. Testes unitários

### Fase 3: Frontend
1. Modificar UserModal para destacar tag sincronizada
2. Indicador visual de vínculo wallet-tag
3. Testes de interface

### Fase 4: Deploy
1. Deploy backend
2. Deploy frontend
3. Monitorar logs

---

## 💡 Recomendação Final

### ✅ Viável, com ressalvas

**Recomendo implementar a Opção 1** (Campo Virtual com destaque), mas com as seguintes precauções:

1. **Manter retrocompatibilidade:** Sistema deve funcionar mesmo sem tag sincronizada
2. **Permitir múltiplas tags:** Tag sincronizada é a "principal", outras são secundárias
3. **Interface clara:** Usuário/admin entende qual é a tag principal
4. **Rollback fácil:** Se der problema, desativar feature via flag

### ⚠️ Antes de implementar, considere:

1. **Validar necessidade real:** Usuários estão confundindo wallet com tag?
2. **Testar com subset:** Implementar em 1-2 usuários primeiro
3. **Documentar bem:** Mudança conceitual importante

---

## ❓ Perguntas para Decisão

1. **Devemos limitar a 1 tag pessoal por usuário?** (simplifica) ou manter múltiplas? (flexível)
2. **Tag sincronizada deve ser obrigatória?** ou opcional?
3. **Como lidar com usuários existentes?** (migração automática?)
4. **Prioridade:** Tag sincronizada sempre "ganha" sobre outras permissões?

---

**Status:** ✅ Análise completa - aguardando decisão do usuário
