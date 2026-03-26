---
description: Review de PR/commit antes de merge
---

# Pre-Landing Review Workflow

## Objetivo
Analisar diff contra branch base para problemas estruturais, segurança e qualidade.

## Passos

### Pass 1 - CRÍTICO (sempre executar primeiro)

1. **SQL & Data Safety**
   - Interpolação de strings em SQL → usar queries parametrizadas
   - Condições TOCTOU → operações atômicas
   - N+1 queries → eager loading

2. **Race Conditions**
   - Read-check-write sem constraint única
   - find-or-create sem índice único
   - Transições de status não atômicas

3. **LLM Output Trust Boundary**
   - Valores gerados por IA sem validação antes de persistir
   - Output estruturado sem verificação de tipo/shape

### Pass 2 - INFORMATIONAL

1. **Conditional Side Effects**
   - Branches que esquecem side effects
   - Logs que não refletem ação real

2. **Dead Code**
   - Variáveis atribuídas mas não lidas
   - Comentários desatualizados

3. **Test Gaps**
   - Testes negativos sem verificar side effects
   - Features de segurança sem testes E2E

## Output Format

```
Pre-Landing Review: N issues (X critical, Y informational)

**AUTO-FIXED:**
- [file:line] Problem → fix applied

**NEEDS INPUT:**
- [file:line] Problem description
  Recommended fix: suggested fix
```

Se nenhum issue: `Pre-Landing Review: No issues found.`
