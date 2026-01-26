---
description: Implement a new feature or complex change following High Caliber Engineering standards
---

# High Caliber Implementation Workflow

This workflow enforces the engineering standards defined in the workspace.

1. **Context & Rules**
   - Read the system rules to ensure compliance.
   - `view_file c:\Users\feliperosa\.gemini\GEMINI.md`

2. **Design Phase (Measure Twice, Cut Once)**
   - Create or update the `implementation_plan.md`.
   - Define the **Objective**, **Scope**, and **Risk Level (N0/N1/N2)**.
   - **CRITICAL**: Do not write code until the plan is clear.

3. **Implementation (Small & Precise)**
   - For every file you intend to modify:
     - **ALWAYS** read the file first: `view_file [path]`
     - **Visual Check**: Count braces `{}` mentally.
     - **Apply Edit**: Use `replace_file_content` for small blocks (<50 lines).
     - **Complex Edit**: Use `multi_replace_file_content` if changing multiple distinct parts.

4. **Validation (Trust but Verify)**
   - After *every* significant edit (or batch of edits):
     - Run the build/check command: `npm run build` (in backend) or relevant script.
     - Verify no lint/syntax errors were introduced.
   - If build fails -> **STOP** -> Fix immediately -> Re-verify.

5. **Final Review**
   - Update `walkthrough.md` with:
     - What was changed.
     - Proof of verification (logs, exit codes).
   - Ensure `task.md` is fully checked.


responder sempre em portugues-br
Regra #1: SEMPRE validar chaves { e }

Cada { precisa ter um } correspondente
Ao fazer edits, contar mentalmente as chaves antes/depois
Verificar se não estou fechando blocos if, for, try antes da hora
Regra #2: Ao usar replace_file_content, COPIAR EXATAMENTE o TargetContent

Não "adivinhar" o conteúdo - SEMPRE usar view_file primeiro
Conferir espaços, tabs, quebras de linha
Um espaço errado = falha total do edit
Regra #3: Fazer edits PEQUENOS e PRECISOS

Evitar substituir blocos grandes de código
Preferir editar 5-10 linhas por vez
Se precisar editar mais, usar multi_replace_file_content
Regra #4: Testar build após edits críticos

Arquivos TypeScript: rodar tsc ou pnpm run build
Confirmar que não há erros de sintaxe

sempre que criar um arquivo .md incluir mapas de fluxo e salvar os arquivos sempre na pasta /markdown do projeto e nao na raiz do temp da workspace

---

## 🔹 POLÍTICA UNIVERSAL DE ENGENHARIA (OBRIGATÓRIA)

Senior Software Engineering Policy

Operating Mode:
- N0 (Draft): exploration allowed, must not break build, leak secrets or destroy data.
- N1 (Production): default; PR-ready quality.
- N2 (Critical): financial, security or data integrity impact.

Mandatory Workflow:
1. Define objective, scope, inputs, outputs, edge cases and mode.
2. Design first, code second; choose the simplest correct solution.
3. Enforce separation of concerns and dependency direction.
4. Apply security by default: validation, authorization, secret management.
5. Implement robust error handling and structured logging.
6. Treat data as critical: migrations, constraints, transactions, idempotency.
7. Add proportional tests and automated checks.
8. Consider performance, limits, retries and cost without premature optimization.
9. Ensure deploy safety: CI compatibility, feature flags, rollback path.
10. Document minimal but sufficient context for future maintainers.

Response Format:
- Objective
- Mode (N0/N1/N2)
- Plan
- Changes
- Edge Cases
- Security & Data
- Tests & Validation
- Rollback / Flags
