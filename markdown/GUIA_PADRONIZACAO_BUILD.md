# Guia de Padronização e Prevenção de Erros de Build

Este documento estabelece práticas para manter a integridade do build e a consistência do código no projeto Whaticket.

## 🔍 Por que erros de build acontecem?
Os erros recentes ocorreram principalmente por:
1.  **Refatoração de Dependências**: Alterar uma função utilitária (`phone.ts`) sem verificar todos os lugares que a importavam.
2.  **Conflitos de Tipagem**: Usar padrões de JavaScript puro (`sequelize.fn`) em um ambiente TypeScript estrito que espera imports específicos (`import { fn } from "sequelize"`).
3.  **Falta de Verificação Local**: Commits realizados sem rodar a verificação de tipos (`tsc`).

## 🛠️ Regras de Ouro para Estabilidade

### 1. Verificação Obrigatória (O MAIS IMPORTANTE)
Sempre execute o comando de build antes de considerar uma tarefa concluída ou subir para produção:
```bash
# No diretório backend
pnpm run build
```
O `tsc` (TypeScript Compiler) é o seu melhor amigo. Se ele passar, 99% das chances de o Docker também passar.

### 2. Padrão de Imports (Sequelize)
Como usamos `sequelize-typescript`, existe uma confusão comum entre o pacote base e o wrapper.
- **Modelos e Colunas**: Use `sequelize-typescript`.
- **Operadores (Op), Funções (fn), Colunas (col) e Literais**: Importe sempre do pacote base `sequelize`.

**Exemplo Correto:**
```typescript
import { Op, fn, col, literal } from "sequelize"; // CORRETO
// vs
import sequelize from "../../database";
sequelize.fn(...); // INCORRETO/DEPRECATED em TS estrito
```

### 3. Impacto de Refatoração
Ao alterar um arquivo utilitário (`utils/*.ts`), use o recurso de busca global (`grep` ou `Buscar em todos os arquivos`) para encontrar TODAS as referências àquela função e atualizá-las.

## 🚀 Proposta de Automação (Husky)
Podemos implementar o **Husky** para impedir que qualquer código seja commitado se não passar no build ou no lint.

**Passos para implementar:**
1. Instalar husky e lint-staged.
2. Adicionar hook `pre-commit: pnpm run build`.

## 📌 Checklist de Segurança para Desenvolvedores (e Agentes AI)
- [ ] Rodei `pnpm run build` após a última linha de código alterada?
- [ ] Verifiquei se removi algum export que outros arquivos dependiam?
- [ ] Os imports do Sequelize estão vindo do pacote `"sequelize"`?
- [ ] O arquivo `.env` tem todas as variáveis novas necessárias?
