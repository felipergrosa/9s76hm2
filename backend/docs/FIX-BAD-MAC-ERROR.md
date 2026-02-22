# 🔧 Correção: Erro Bad MAC / Sessão Corrompida

## Problema
```
Session error: Error: Bad MAC
No matching sessions found for message
```

Mensagens não são descriptografadas e são descartadas pelo filtro.

---

## Causa Raiz

1. **Sessão corrompida** - Arquivos de autenticação Signal inválidos
2. **Chaves de criptografia inválidas** - Dispositivo trocou ou sessão resetou
3. **Conflito PROD+DEV** - Mesmo número em duas instâncias corrompe sessão

---

## 🔧 Solução Passo a Passo

### Passo 1: Parar TODAS as instâncias
```bash
# Parar PROD
docker stop <container_prod>

# Parar DEV
# Ctrl+C no terminal de desenvolvimento
```

### Passo 2: Limpar Locks Redis
```bash
# Conectar ao Redis
redis-cli

# Listar todos os locks
KEYS wbot:mutex:*

# Deletar TODOS os locks
DEL wbot:mutex:13
DEL wbot:mutex:26
# ... ou deletar todos de uma vez:
EVAL "return redis.call('del', unpack(redis.call('keys', 'wbot:mutex:*')))" 0

# Sair do Redis
exit
```

### Passo 3: Limpar Sessão Corrompida (CRÍTICO)

**OPÇÃO A: Deletar sessão completamente (RECOMENDADO)**
```bash
# No servidor PROD (Docker)
docker exec -it <container> sh
rm -rf /app/tokens/whatsapp_26

# No DEV (local)
rm -rf c:\Users\feliperosa\whaticket\backend\tokens\whatsapp_13
```

**OPÇÃO B: Deletar apenas chaves Signal**
```bash
# Apenas se quiser tentar preservar a sessão
# Deletar arquivos de chave Signal (pode não funcionar)
rm -rf tokens/whatsapp_*/auth/*
```

### Passo 4: Reiniciar apenas UMA instância
```bash
# IMPORTANTE: Reconectar apenas UMA instância por vez!
# Escolha PROD OU DEV, não ambos simultaneamente

# Reiniciar PROD
docker start <container_prod>

# OU reiniciar DEV
npm run dev
```

### Passo 5: Reconectar WhatsApp
1. Acessar interface do Whaticket
2. Ir em **Conexões** → **WhatsApp**
3. Clicar em **Conectar** (ou **Reconectar**)
4. **Escanear QR Code** com o celular

---

## ⚠️ IMPORTANTE: Multi-Device com Mesmo Número

**NÃO use o mesmo número WhatsApp em PROD e DEV simultaneamente!**

Isso causa:
- Conflito de sessão
- Erros de criptografia (Bad MAC)
- Mensagens perdidas
- Possível banimento

### Solução Permanente:
1. **Use números diferentes** para PROD e DEV
2. **OU** configure apenas UMA instância para conectar
3. **OU** use variável de ambiente para controlar qual instância conecta:

```env
# Em PROD
WHATSAPP_ENABLED=true

# Em DEV
WHATSAPP_ENABLED=false  # Não conecta, apenas testa código
```

---

## 🔍 Verificar se Corrigiu

Após reconectar, verifique os logs:

```bash
# Deve aparecer:
[WbotMutex] Lock adquirido para whatsappId=XX
[wbotMessageListener] ✅ Esta conexão é LÍDER para 5519992461008
[messages.upsert] Após filtro: 1 mensagens válidas  ← IMPORTANTE!
```

**Se ainda aparecer "0 mensagens válidas":**
1. Sessão ainda está corrompida
2. Repetir Passo 3 (deletar sessão completamente)
3. Reconectar e escanear QR novamente

---

## 📞 Checklist Final

- [ ] Parou TODAS as instâncias (PROD + DEV)
- [ ] Limpou locks Redis (`DEL wbot:mutex:*`)
- [ ] Deletou sessão corrompida (`rm -rf tokens/whatsapp_*`)
- [ ] Reiniciou apenas UMA instância
- [ ] Escaneou QR Code
- [ ] Verificou logs: "1 mensagens válidas"
- [ ] Testou enviar/receber mensagem

---

## 🚨 Se Ainda Não Funcionar

1. **Verificar se número foi banido**
   - Tentar enviar mensagem pelo celular
   - Se não enviar, número pode estar banido

2. **Verificar arquivos de sessão**
   ```bash
   ls -la tokens/
   # Deve estar vazio após deletar
   ```

3. **Verificar Redis**
   ```bash
   redis-cli ping
   # Deve retornar: PONG
   ```

4. **Verificar logs completos**
   ```bash
   grep -E "Bad MAC|decrypt|Session error" logs.txt
   # Se aparecer, sessão ainda corrompida
   ```
