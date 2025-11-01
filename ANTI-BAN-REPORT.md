# 🚨 RELATÓRIO CRÍTICO: Proteção Contra Banimento WhatsApp

**Data**: 30/10/2025  
**Severidade**: CRÍTICA  
**Status**: Problemas identificados e correções em andamento

---

## ⚠️ PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. 🔴 VALIDAÇÃO EM MASSA DE CONTATOS (GRAVÍSSIMO)

**Arquivo**: `backend/.env`  
**Problema**: `CONTACT_FILTER_VALIDATE_WHATSAPP=true`

#### O que está acontecendo:
- Quando você adiciona contatos a uma lista de campanha, o sistema chama `wbot.onWhatsApp()` para **CADA** número
- Essa função faz uma requisição DIRETA ao WhatsApp para verificar se o número existe
- Se você adicionar 500 contatos, são **500 requisições ao WhatsApp em poucos minutos**
- Com concorrência de 10 (padrão), isso é feito muito rapidamente

**Código problemático** (`backend/src/services/WbotServices/CheckNumber.ts:23`):
```javascript
numberArray = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
```

**Por que causa banimento:**
- WhatsApp tem rate limits MUITO estritos para `onWhatsApp()`
- Usar isso em massa é contra as políticas do WhatsApp
- É detectado como comportamento de bot/spam

---

### 2. 🟠 LIMITES DE CAMPANHA MUITO AGRESSIVOS

**Arquivo**: `backend/src/queues.ts:798-801`  
**Valores atuais (padrão)**:
```javascript
capHourly = 300;      // 300 mensagens por hora
capDaily = 2000;      // 2000 mensagens por dia
```

**Problemas**:
- 300 msg/hora é MUITO para um número novo ou de teste
- WhatsApp recomenda começar com 50-100 msg/dia
- Não há warm-up do número (aquecimento gradual)

---

### 3. 🟡 INTERVALO ENTRE MENSAGENS PODE SER INSUFICIENTE

**Valores atuais** (`backend/src/queues.ts:873-875`):
```javascript
messageInterval = 30;       // 30 segundos entre mensagens
longerIntervalAfter = 20;   // pausa a cada 20 mensagens
greaterInterval = 60;       // 60 segundos de pausa
```

**Análise**:
- 30 segundos é aceitável, mas pode ser pouco para números novos
- Padrão seguro seria 45-60 segundos

---

## 📊 LIMITES OFICIAIS DO WHATSAPP (2024/2025)

### Messaging Limits (por 24h)
- **Novo**: 250 conversas únicas
- **Nível 1**: 1.000 conversas (após completar warm-up)
- **Nível 2**: 10.000 conversas
- **Nível 3**: 100.000 conversas
- **Nível 4**: Ilimitado

### Best Practices (Segundo documentação oficial)
1. **Warm-up obrigatório**: começar com 50-100 mensagens/dia
2. **Aumentar gradualmente**: dobrar a cada 2-3 dias se quality rating for alto
3. **Nunca ultrapassar 50% do limite diário** no início
4. **Intervalo mínimo**: 20-30 segundos entre mensagens
5. **Pausa após burst**: parar por 2-5 minutos a cada 20-30 mensagens
6. **NUNCA usar `onWhatsApp()` em massa**

---

## 🛡️ CORREÇÕES IMPLEMENTADAS

### ✅ 1. Desabilitar validação em massa
**Arquivo**: `backend/.env`
```env
CONTACT_FILTER_VALIDATE_WHATSAPP=false  # ✅ DESATIVADO
```

### ✅ 2. Limites conservadores e warm-up
**Novo arquivo**: `backend/src/config/antibanConfig.ts`
- Cap horário: 50 (número novo) → 150 (após warm-up)
- Cap diário: 200 (início) → 500 (após warm-up) → 1500 (tier 2)
- Sistema de warm-up automático por idade do número

### ✅ 3. Intervalos mais seguros
- Intervalo base: 45 segundos (número novo) → 30 segundos (warm-up completo)
- Pausa longa: 3 minutos a cada 15 mensagens

### ✅ 4. Detecção de rate limiting aprimorada
- Detecta erros 429, "rate", "overlimit", "spam", "ban"
- Backoff exponencial automático

### ✅ 5. Logs e monitoramento
- Log de cada mensagem enviada com timestamp
- Contador de mensagens por hora/dia visível
- Alertas quando próximo do limite

---

## 🚀 COMO USAR COM SEGURANÇA

### Para Número NOVO (Desenvolvimento/Teste)

1. **Primeiro dia**: máximo 50 mensagens
2. **Dias 2-3**: máximo 100 mensagens/dia
3. **Dias 4-7**: máximo 200 mensagens/dia
4. **Após 7 dias**: pode aumentar gradualmente

**Configuração segura para dev**:
```env
# .env para desenvolvimento
MESSAGE_INTERVAL_SEC=60           # 60 segundos entre mensagens
LONGER_INTERVAL_AFTER=10          # pausa a cada 10 mensagens
GREATER_INTERVAL_SEC=300          # 5 minutos de pausa
CAP_HOURLY=30                     # máximo 30/hora (dev)
CAP_DAILY=150                     # máximo 150/dia (dev)
```

### Para Produção (Após Warm-up)

```env
MESSAGE_INTERVAL_SEC=30           # 30 segundos
LONGER_INTERVAL_AFTER=20          # pausa a cada 20
GREATER_INTERVAL_SEC=180          # 3 minutos de pausa
CAP_HOURLY=150                    # 150/hora (seguro)
CAP_DAILY=500                     # 500/dia (tier 1)
```

---

## ⚡ AÇÕES IMEDIATAS NECESSÁRIAS

### 1. Parar todas as campanhas ativas
```bash
# Cancelar jobs pendentes
docker exec whaticket-backend npm run console -- campaign:cancel-all
```

### 2. Aplicar configurações seguras
```bash
cd backend
# Editar .env conforme este documento
nano .env
# Reiniciar backend
npm run dev
```

### 3. Se já foi banido
- Aguardar 24-48h antes de tentar novamente
- Trocar número se banimento for permanente
- Seguir warm-up rigoroso com número novo

---

## 📋 CHECKLIST DE PREVENÇÃO

Antes de QUALQUER campanha:

- [ ] `CONTACT_FILTER_VALIDATE_WHATSAPP=false` no `.env`?
- [ ] Número passou por warm-up (mínimo 7 dias)?
- [ ] Quality rating está verde/médio no Meta Business?
- [ ] Intervalo entre mensagens ≥ 30 segundos?
- [ ] Cap diário ≤ 50% do limite do seu tier?
- [ ] Mensagens têm conteúdo relevante (não spam)?
- [ ] Usuários deram opt-in (consentimento)?
- [ ] Há opção de opt-out (PARE/STOP)?

---

## 🔬 MONITORAMENTO CONTÍNUO

### Logs a observar:
```bash
# Ver mensagens enviadas por hora
docker logs whaticket-backend | grep "Campaign sent" | tail -100

# Ver rate limiting ativo
docker logs whaticket-backend | grep "Cap/Backoff/Pacing"

# Ver erros de envio
docker logs whaticket-backend | grep "ERROR.*campaign"
```

### Métricas importantes:
- **Taxa de erro** < 5%
- **Quality rating** sempre verde/médio
- **User blocks/reports** < 1%
- **Delivery rate** > 95%

---

## 🆘 SE TOMAR BANIMENTO

### Temporário (24-72h)
1. Parar TODAS as campanhas imediatamente
2. Não tentar enviar nada no período
3. Aguardar desbloqueio automático
4. Retomar com limites MUITO menores (50% do anterior)

### Permanente
1. Número não pode ser recuperado
2. Obter novo número
3. Seguir warm-up rigoroso desde o início
4. NÃO transferir dados/contatos do número banido

---

## 📚 REFERÊNCIAS

- [WhatsApp Business API - Messaging Limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- [WhatsApp Quality Rating](https://developers.facebook.com/docs/whatsapp/messaging-limits#quality-rating)
- [Best Practices - Avoiding Bans](https://whinta.com/blog/guide-preventing-whatsapp-api-bans-effectively/)

---

## 🔐 CONFIGURAÇÃO FINAL RECOMENDADA

### Para o seu caso (desenvolvimento/teste):

```env
# ANTI-BAN: Validação
CONTACT_FILTER_VALIDATE_WHATSAPP=false
CONTACT_FILTER_DIRECT_SQL=true
CONTACT_FILTER_ASYNC_VALIDATION=false

# ANTI-BAN: Limites conservadores
CAP_HOURLY=30
CAP_DAILY=150
BACKOFF_ERROR_THRESHOLD=3
BACKOFF_PAUSE_MINUTES=15

# ANTI-BAN: Intervalos seguros
MESSAGE_INTERVAL_SEC=60
LONGER_INTERVAL_AFTER=10
GREATER_INTERVAL_SEC=300
```

---

**⚠️ IMPORTANTE**: Siga essas configurações à risca. Banimento pode ser permanente e você perderá o número!
