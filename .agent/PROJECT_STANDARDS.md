# Padrões Técnicos do Projeto (Whaticket)

Este arquivo serve como instrução permanente para desenvolvedores e IAs.

## 1. Integridade do Build
- O build (`pnpm run build` ou `tsc`) deve passar sem erros antes de qualquer commit.
- Erros de "Property 'fn' does not exist on type 'Sequelize'" devem ser corrigidos importando `fn` diretamente de `sequelize`.

## 2. Normalização de Contatos
- NUNCA assuma que um número de telefone tem no máximo 13 dígitos. Aceite até 20 para compatibilidade com IDs da Meta.
- Use sempre `safeNormalizePhoneNumber` do `utils/phone.ts`.

## 3. Fluxo de Trabalho
- Documente mudanças complexas em `/markdown/walkthrough_XXXX.md`.
- Siga os padrões de tipagem estrita do TypeScript.
