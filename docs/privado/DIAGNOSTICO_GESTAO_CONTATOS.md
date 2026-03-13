# Diagnóstico e Plano de Unificação: Normalização de Contatos

Identificamos que, embora a lógica central (`phone.ts`) e os serviços de recebimento de mensagens já usem a nova normalização, a ferramenta de **Gestão de Contatos** (exibida no print) ainda opera sob regras legadas.

## 🔍 Pontos de Atenção (Gaps)

### 1. Validação de WhatsApp (ValidateContactNumbersService.ts)
- **Problema**: Atualmente filtra apenas números que começam com `55` (Brasil) via Query SQL.
- **Impacto**: Números internacionais ou IDs Longos da Meta não aparecem para serem validados.
- **Lógica Legada**: Possui uma função manual `removeNineDigit` que ignora a inteligência da `libphonenumber-js`.

### 2. Detecção de Duplicatas (ListDuplicateContactsService.ts)
- **Problema**: Agrupa duplicatas usando uma lógica de "pegar os últimos 11 dígitos" no banco.
- **Impacto**: Pode gerar falsos positivos para números de outros países ou falhar ao identificar duplicatas de IDs Longos que variam no início.

### 3. Processamento de Duplicatas (ProcessDuplicateContactsService.ts)
- **Problema**: Repete a lógica de truncamento de dígitos para encontrar o grupo de mesclagem.

---

## 🛠️ Proposta de Implementação

### 1. [ValidateContactNumbersService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactServices/ValidateContactNumbersService.ts)
- Remover a trava de `REGEXP '^55...'` no SQL para permitir validar qualquer contato.
- Substituir a lógica manual de dígito 9 pelo uso da `safeNormalizePhoneNumber`.
- Permitir que a ferramenta valide números internacionais.

### 2. [ListDuplicateContactsService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactServices/ListDuplicateContactsService.ts)
- Alterar a Query SQL para agrupar diretamente pela coluna `canonicalNumber`.
- Como agora todos os contatos ganham um `canonicalNumber` ao salvar (via Hook do Modelo), a detecção será 100% precisa e rápida.

### 3. [ProcessDuplicateContactsService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/ContactServices/ProcessDuplicateContactsService.ts)
- Simplificar a busca de membros do grupo usando correspondência exata de `canonicalNumber`.

---

## ✅ Verificação Pós-Ajustes
- Rodar `pnpm run build` ✅.
- Testar a aba "Validar WhatsApp" com um contato de outro país.
- Testar a aba "Duplicatas" com IDs longos.
