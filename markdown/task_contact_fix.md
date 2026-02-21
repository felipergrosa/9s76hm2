# Task: Resolver Duplicação de Contatos e Tickets na Resposta de Mensagens

## Planejamento [PLANNING]
- [x] Pesquisar lógica de recebimento de mensagens em `wbotMessageListener.ts`
- [x] Analisar `CreateOrUpdateContactService.ts` para entender critérios de busca de contato
- [x] Identificar a causa da falha na identificação do contato existente (IDs > 13 dígitos)
- [x] Criar plano de implementação em `implementation_plan.md` com `libphonenumber-js`
- [x] Obter aprovação do usuário para o novo plano (implícito pela sugestão da lib)

## Execução [EXECUTION]
- [x] Instalar `libphonenumber-js` no backend
- [x] Refatorar `backend/src/utils/phone.ts` para usar a lib e permitir IDs até 20 dígitos
- [x] Atualizar `extractMessageIdentifiers.ts` para permitir comprimentos maiores
- [x] Atualizar `ContactResolverService.ts` relaxando travas de comprimento
- [x] Atualizar `resolveContact.ts` e `createContact.ts` para reforçar busca por número/LID
- [x] Atualizar `CreateOrUpdateContactService.ts` com as novas validações de comprimento
- [x] Corrigir incompatibilidades no `ListContactsPendingNormalizationService.ts`
- [x] **BÔNUS**: Tratar DDIs duplicados ("5555...") no `phone.ts` [SUGESTÃO USUÁRIO]
- [x] **BÔNUS**: Criar `AutoMergeDuplicateContactsService.ts` para limpeza de banco [SUGESTÃO USUÁRIO]

## Verificação [VERIFICATION]
- [x] Validar build do backend (`pnpm run build`)
- [x] Testar recebimento de mensagem de ID longo e verificar associação de contato
- [x] Criar walkthrough.md completo com as mudanças e validações
