# ⚡ Guia Rápido: Como Usar Sem Tomar Ban

**Última atualização**: 30/10/2025  
**Para**: Desenvolvimento/Teste com número pessoal

---

## ✅ ANTES DE QUALQUER CAMPANHA

### 1. Verificar configuração do `.env`

Abra `backend/.env` e confirme:

```env
CONTACT_FILTER_VALIDATE_WHATSAPP=false  # ✅ DEVE ESTAR false
CAP_HOURLY=30                          # ✅ Máximo 30 msg/hora
CAP_DAILY=150                          # ✅ Máximo 150 msg/dia
MESSAGE_INTERVAL_SEC=60                # ✅ 60 segundos entre msgs
```

❌ **SE `CONTACT_FILTER_VALIDATE_WHATSAPP=true` → PARE TUDO E MUDE PARA `false`**

---

## 🎯 LIMITES SEGUROS (SEU CASO)

| Período | Máximo Seguro | Seu Limite Atual |
|---------|---------------|------------------|
| **Por hora** | 30 mensagens | `CAP_HOURLY=30` |
| **Por dia** | 150 mensagens | `CAP_DAILY=150` |
| **Entre mensagens** | 60 segundos | `MESSAGE_INTERVAL_SEC=60` |
| **Pausa a cada** | 10 mensagens | `LONGER_INTERVAL_AFTER=10` |
| **Tempo de pausa** | 5 minutos | `GREATER_INTERVAL_SEC=300` |

---

## 📊 EXEMPLO PRÁTICO

### ❌ NÃO FAÇA:
```
09:00 - Adicionar 500 contatos à lista
09:05 - Iniciar campanha
Resultado: 500 validações de WhatsApp em 5min = BAN GARANTIDO
```

### ✅ FAÇA:
```
09:00 - Adicionar 30 contatos à lista (SEM validação)
09:05 - Iniciar campanha
09:35 - Envio de 10 mensagens concluído
09:40 - Pausa de 5 minutos
09:45 - Continua enviando (20 mensagens restantes)
```

---

## 🚦 SEMÁFORO DE SEGURANÇA

### 🟢 ZONA VERDE (Seguro)
- Até 20 mensagens/hora
- Até 100 mensagens/dia
- Intervalos de 60+ segundos
- Pausas frequentes

### 🟡 ZONA AMARELA (Cuidado)
- 20-30 mensagens/hora
- 100-150 mensagens/dia
- Intervalos de 30-60 segundos
- Monitorar logs atentamente

### 🔴 ZONA VERMELHA (PERIGO!)
- Mais de 30 mensagens/hora
- Mais de 150 mensagens/dia
- Intervalos < 30 segundos
- **PARE IMEDIATAMENTE!**

---

## 📝 CHECKLIST DIÁRIO

Antes de iniciar campanhas hoje:

- [ ] Backend rodando com `.env` correto?
- [ ] Logs mostrando `[ANTI-BAN]` nas mensagens?
- [ ] Já enviei menos de 100 mensagens hoje?
- [ ] Intervalos estão sendo respeitados (ver logs)?
- [ ] Não vou adicionar mais de 50 contatos de uma vez?

---

## 🔍 COMO MONITORAR

### Ver logs do backend:
```powershell
# Filtrar apenas envios de campanha
docker logs whaticket-backend 2>&1 | Select-String "ANTI-BAN"
```

**O que você verá:**
```
✅ [ANTI-BAN] Mensagem enviada | Campanha=5 | Contato=João | WhatsApp=1 | Hora: 12/30 | Dia: 78/150
```

Isso significa:
- **12/30**: Enviou 12 mensagens na última hora (limite: 30)
- **78/150**: Enviou 78 mensagens hoje (limite: 150)

### ⚠️ ALERTAS:

Se aparecer:
```
Cap/Backoff/Pacing ativo. Reagendando envio
```
✅ **Isso é BOM!** Significa que o sistema está protegendo você.

Se aparecer:
```
ERROR: rate-overlimit
ERROR: 429
ERROR: spam
```
🔴 **PARE TUDO!** Você está sendo limitado pelo WhatsApp.

---

## 🆘 SE DER ERRO

### Erro: "rate-overlimit" ou "429"
```bash
# 1. Cancelar todas as campanhas
# No banco ou via interface

# 2. Aguardar 1 hora sem enviar nada

# 3. Reduzir limites pela metade
CAP_HOURLY=15
CAP_DAILY=75

# 4. Reiniciar backend
npm run dev
```

### Erro: "This number is not registered on WhatsApp"
- Normal, não é ban
- Contato não tem WhatsApp
- Sistema irá pular automaticamente

---

## 💡 DICAS DE OURO

1. **Comece devagar**: Primeiro dia? Máximo 50 mensagens
2. **Horário comercial**: Envie entre 9h-18h (parece mais humano)
3. **Intervalos variados**: Sistema já adiciona aleatoriedade (bom!)
4. **Conteúdo relevante**: Mensagens genéricas = mais reports = mais ban
5. **Opt-out sempre**: Sempre ofereça "responda PARE para sair"

---

## 📞 NÚMEROS PARA TESTE

### ❌ Não use:
- Seu número pessoal principal
- Números de clientes reais
- Números compartilhados

### ✅ Use:
- Número de teste dedicado
- Chip separado
- WhatsApp Business API (ideal)

---

## 🎓 WARM-UP (Aquecimento de Número)

Se seu número for NOVO:

| Dia | Máximo | Intervalo |
|-----|--------|-----------|
| 1-2 | 20 msg | 120 seg |
| 3-4 | 50 msg | 90 seg |
| 5-7 | 100 msg | 60 seg |
| 8-14 | 150 msg | 45 seg |
| 15+ | 300 msg | 30 seg |

**Seu número atual**: use perfil "1-2 dias" por segurança

---

## ✅ CONFIGURAÇÃO ATUAL (Aplicada)

```env
# Validação desabilitada (crítico!)
CONTACT_FILTER_VALIDATE_WHATSAPP=false

# Limites conservadores
CAP_HOURLY=30
CAP_DAILY=150

# Intervalos seguros
MESSAGE_INTERVAL_SEC=60
LONGER_INTERVAL_AFTER=10
GREATER_INTERVAL_SEC=300

# Backoff rápido
BACKOFF_ERROR_THRESHOLD=3
BACKOFF_PAUSE_MINUTES=15
```

---

## 🚀 COMANDO PARA RODAR

```powershell
# 1. Confirmar configuração
cd C:\Users\feliperosa\whaticket\backend
cat .env | Select-String "VALIDATE|CAP|INTERVAL"

# 2. Rodar backend
npm run dev

# 3. Em outro terminal, monitorar
Get-Content -Wait *.log | Select-String "ANTI-BAN"
```

---

**LEMBRE-SE**: É melhor enviar 50 mensagens com segurança do que 500 e perder o número!

---

📚 **Documentação completa**: Ver `ANTI-BAN-REPORT.md`
