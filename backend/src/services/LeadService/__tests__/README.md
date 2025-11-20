# Testes - Mensagem Automática de Boas-Vindas para Leads

## 📋 Visão Geral

Este diretório contém os testes unitários para a funcionalidade de mensagem automática de boas-vindas para leads.

## 🧪 Arquivos de Teste

### `SendWelcomeMessageService.spec.ts`
Testes para o serviço que envia mensagens de boas-vindas automaticamente quando um lead é criado.

**Cenários testados:**
- ✅ Envio de mensagem quando tudo está configurado corretamente
- ✅ Uso de mensagem customizada
- ✅ Funcionamento sem fila configurada
- ✅ Tratamento quando WhatsApp não é encontrado
- ✅ Tratamento quando WhatsApp não está conectado
- ✅ Tratamento quando não consegue criar ticket
- ✅ Tratamento de erros ao enviar mensagem
- ✅ Funcionamento sem configurações da empresa
- ✅ Validação de mensagem padrão

### `../controllers/__tests__/LeadController.spec.ts`
Testes para o controller de leads, incluindo a integração com o serviço de mensagem.

**Cenários testados:**
- ✅ Criação de novo lead com sucesso
- ✅ Salvamento de mensagem como extraInfo
- ✅ Chamada do SendWelcomeMessageService
- ✅ Limpeza e formatação de número de telefone
- ✅ Atualização de contato existente
- ✅ Adição de tag Lead
- ✅ Validação de campos obrigatórios
- ✅ Validação de email
- ✅ Validação de tamanho de mensagem
- ✅ Tratamento de erros diversos
- ✅ Campos opcionais

## 🚀 Como Executar

### Executar todos os testes
```bash
cd backend
npm test
```

### Executar apenas os testes de leads
```bash
cd backend
npm test -- LeadService
```

### Executar em modo watch
```bash
cd backend
npm test -- --watch LeadService
```

### Executar com cobertura
```bash
cd backend
npm test -- --coverage LeadService
```

## 📊 Cobertura de Testes

Os testes cobrem:
- ✅ **SendWelcomeMessageService**: 100% dos cenários principais
- ✅ **LeadController.store**: 100% dos fluxos principais
- ✅ Validações de entrada
- ✅ Tratamento de erros
- ✅ Casos de borda

## 🔧 Estrutura dos Testes

### Mocks Utilizados
- `GetDefaultWhatsApp` - Busca WhatsApp padrão
- `FindOrCreateTicketService` - Cria/encontra ticket
- `SendWhatsAppMessage` - Envia mensagem WhatsApp
- `CompaniesSettings` - Configurações da empresa
- `Queue` - Filas de atendimento
- `Contact`, `Company`, `Tag`, `ContactTag` - Modelos do banco

### Padrão de Teste
Cada teste segue o padrão AAA (Arrange, Act, Assert):
1. **Arrange**: Configurar mocks e dados de teste
2. **Act**: Executar a função sendo testada
3. **Assert**: Verificar os resultados esperados

## 📝 Notas

- Os testes são **unitários** e usam mocks para isolar a funcionalidade
- Erros não críticos (como falha ao adicionar tag) não bloqueiam o fluxo
- O envio de mensagem é **assíncrono** e não bloqueia a resposta da API
- Todos os testes são executados em ambiente isolado

## ✅ Checklist de Testes

- [x] Testes de sucesso implementados
- [x] Testes de erro implementados
- [x] Testes de validação implementados
- [x] Testes de casos de borda implementados
- [x] Mocks configurados corretamente
- [x] Cobertura adequada

---

**Última atualização:** 2025-01-27

