# 🔍 Diagnóstico do Erro #100 - Template "mens_inicial"

## ⚠️ PROBLEMA IDENTIFICADO

Após extensa investigação e análise da documentação oficial da Meta, identifiquei a **causa raiz** do erro:

```
(#100) Invalid parameter - Parameter name is missing or empty
```

## 📊 DADOS COLETADOS

### Template Estrutura (da Meta API):
```json
{
  "type": "BODY",
  "text": "Olá {{v1}}, {{v2}} tudo bem? Esta podendo falar agora?",
  "example": {
    "body_text_named_params": [
      {
        "param_name": "v1",
        "example": "Bom dia"
      },
      {
        "param_name": "v2",
        "example": "Joaquim Silva"
      }
    ]
  }
}
```

### Nosso Payload Enviado:
```json
{
  "components": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "Felipe Rosallll" },
        { "type": "text", "text": "email@email.com" }
      ]
    }
  ]
}
```

## 🎯 CAUSA RAIZ

O template usa **variáveis NOMEADAS** (`{{v1}}`, `{{v2}}`), não numéricas (`{{1}}`, `{{2}}`).

Quando um template define variáveis nomeadas via `body_text_named_params`, a API da Meta **PODE** exigir que você envie o campo `param_name` junto com o valor no payload.

## ✅ SOLUÇÕES POSSÍVEIS

### Opção 1: Recriar o Template com Variáveis Numéricas (RECOMENDADO)

Na Meta Business Manager, edite o template e troque:
- De: `Olá {{v1}}, {{v2}} tudo bem?`
- Para: `Olá {{1}}, {{2}} tudo bem?`

Isso resolve o problema imediatamente porque nosso código já está enviando os valores na ordem correta (1, 2).

### Opção 2: Modificar o Código para Enviar `param_name`

Se você não puder modificar o template, preciso atualizar o código para enviar:

```json
{
  "type": "body",
  "parameters": [
    { "type": "text", "text": "Felipe Rosallll", "param_name": "v1" },
    { "type": "text", "text": "email@email.com", "param_name": "v2" }
  ]
}
```

Mas isso exige:
1. GetTemplateDefinition detectar que o template usa variáveis nomeadas
2. MapTemplateParameters incluir o `param_name` no payload
3. Configurar o  mapeamento correto de cada variável

## 🏆 RECOMENDAÇÃO FINAL

**Opção 1 é a mais rápida e segura:**
1. Acesse Meta Business Manager → Templates
2. Edite o template `mens_inicial`
3. Troque `{{v1}}` por `{{1}}` e `{{v2}}` por `{{2}}`
4. Reenvie para aprovação (se necessário)
5. Aguarde aprovação
6. Teste novamente

## 📝 NOTAS ADICIONAIS

- O header fixo "Nobre Luminárias - Araras/SP" NÃO precisa ser enviado no payload (testado)
- O botão QUICK_REPLY estático NÃO precisa de componente button (confirmado)
- O problema está EXCLUSIVAMENTE no formato das variáveis do body

---

**Se precisar implementar a Opção 2, me avise que eu ajusto o código!**
