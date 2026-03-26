---
description: QA sistemático de aplicação web
---

# QA Workflow

## Objetivo
Testar aplicação web sistematicamente, encontrar bugs e verificar fixes.

## Tiers
- **Quick**: Apenas críticos/high
- **Standard**: + medium
- **Exhaustive**: + cosmetic

## Passos

1. **Navegação e Interação**
   - Abrir URL alvo
   - Testar fluxos de usuário
   - Verificar responsividade

2. **Verificação de Estado**
   - Validar mudanças após interações
   - Verificar persistência de dados
   - Testar edge cases

3. **Captura de Evidência**
   - Screenshots de bugs
   - Logs de console
   - Network requests

4. **Fix Loop**
   - Corrigir bug encontrado
   - Commit atômico
   - Re-verificar

## Output

```
QA Report: N bugs found (X critical, Y high, Z medium)

**FIXED:**
- [Bug description] → fix applied in [file:line]

**NEEDS VERIFICATION:**
- [Bug description]
  Evidence: [screenshot/log]
```
