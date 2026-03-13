# 🔍 ROOT CAUSE ANALYSIS - Error #100

## DESCOBERTA CRÍTICA

Após pesquisa extensiva, identifiquei que:

1. **`body_text_named_params` é usado APENAS na CRIAÇÃO do template**
2. **NO ENVIO da mensagem, sempre usamos `{"type": "text", "text": "valor"}` em ordem**  
3. **O nome da variável (`v1`, `v2`) NÃO afeta o envio - é apenas visual**

## O VERDADEIRO PROBLEMA

O template `mens_inicial` tem:
```json
{
  "HEADER": "Nobre Luminárias - Araras/SP" (fixo, sem parâmetros),
  "BODY": "Olá {{v1}}, {{v2}}..." (2 parâmetros),
  "BUTTONS": [...] (sem parâmetros)
}
```

Mas estamos enviando APENAS:
```json
{
  "components": [
    {
      "type":
