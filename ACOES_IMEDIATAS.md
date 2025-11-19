# ⚡ AÇÕES IMEDIATAS - Corrigir BOT e Imagens

## 🎯 RESUMO DOS PROBLEMAS

1. **BOT sempre ativo** - Todos os tickets vão para aba BOT (errado!)
2. **Imagens não aparecem** - Imagens enviadas/recebidas não são exibidas

---

## 🚀 PASSO 1: DIAGNÓSTICO DE IMAGENS (5 minutos)

Execute o script de diagnóstico:

```bash
cd backend
node scripts/diagnostico-imagens.js
```

### O que o script faz:

✅ Verifica se arquivos existem fisicamente  
✅ Checa permissões  
✅ Compara banco de dados vs disco  
✅ Lista problemas encontrados  
✅ Mostra estrutura de pastas  
✅ Dá recomendações  

### Resultado Esperado:

```
🔍 DIAGNÓSTICO DE IMAGENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Testando conexão com banco de dados...
   ✅ Conectado ao banco

2️⃣  Buscando mensagens com mídia...
   📊 Encontradas 10 mensagens com mídia

3️⃣  Verificando arquivos físicos...

   ┌─ Mensagem #456
   │  Contato: Felipe Rosaliii
   │  Tipo: image
   │  De mim: Não
   │  Data: 18/11/2025 09:43:00
   │  mediaUrl no banco: contact1676/1703441966659_image.png
   │  Caminho esperado: C:\...\public\company1\contact1676\1703441966659_image.png
   │  ✅ Arquivo existe! (0.25 MB)
   │  ✅ Permissões OK (leitura)
   │  🌐 URL pública: https://chatsapi.nobreluminarias.com.br/public/company1/contact1676/1703441966659_image.png
   └─
```

### Se arquivos NÃO existem:

```
   │  ❌ Arquivo NÃO encontrado!
   │  ⚠️  Pasta não existe: C:\...\public\company1\contact1676
```

**→ Problema: Arquivos não estão sendo salvos!**

### Se arquivos existem mas não aparecem:

```
   │  ✅ Arquivo existe!
```

**→ Problema: Frontend ou servidor não está servindo corretamente**

---

## 🔧 PASSO 2: CORREÇÃO DO FLUXO BOT (15 minutos)

### Problema Atual:

**TODOS** os tickets novos vão direto para "BOT", mesmo sem fila ou chatbot configurado!

### Solução:

Modificar `FindOrCreateTicketService.ts` para:
1. Criar tickets como "pending" (não "bot")
2. Mudar para "bot" SOMENTE quando fila tiver chatbot

### Implementação:

Vou criar o patch agora:

