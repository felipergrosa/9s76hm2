# 🧪 COMO TESTAR AS MELHORIAS DE CAMPANHAS

## 📋 Pré-requisitos

### 1. Executar a Migration (OBRIGATÓRIO)
```bash
cd backend
npm run build
npm run db:migrate
```

**Importante**: A migration adiciona as colunas `attempts`, `lastError`, `lastErrorAt` e `status` na tabela `CampaignShipping`. Sem ela, o sistema dará erro.

### 2. Reiniciar o Backend
```bash
npm run dev:fast
```

---

## ✅ TESTES A REALIZAR

### Teste 1: Layout da Página de Campanhas
1. Acesse `/campaigns`
2. **Verificar**: Tabela deve ocupar toda a largura da tela
3. **Verificar**: Não deve ter barra de rolagem dupla
4. **Verificar**: Scroll único e suave

### Teste 2: Editar Campanha Pausada
1. Crie uma campanha e inicie
2. Pause a campanha (botão de pausa)
3. Status deve mudar para "CANCELADA"
4. Clique em **Editar** (ícone de lápis)
5. **Verificar**: Modal de edição deve abrir
6. Altere o nome ou mensagem
7. Salve
8. **Resultado Esperado**: Campanha editada com sucesso

### Teste 3: Retomar Campanha Pausada
1. Com uma campanha pausada (CANCELADA)
2. Clique no botão **Play** (ícone de play)
3. **Verificar no console backend**:
   ```
   [RESTART CAMPAIGN] ID=X | Enviados: Y/Z
   [RESTART CAMPAIGN] Campanha X reiniciada com sucesso
   ```
4. **Resultado Esperado**: 
   - Campanha muda para "EM_ANDAMENTO"
   - Continua de onde parou (não reenvia para contatos já enviados)

### Teste 4: Monitoramento de Falhas
1. Crie uma campanha com 5-10 contatos
2. Inicie o envio
3. **Verificar nos logs**:
   ```bash
   tail -f backend/logs/app.log | grep CAMPAIGN
   ```
4. **Logs esperados**:
   ```
   Disparo de campanha solicitado: Campanha=X;Registro=Y
   Campanha enviada para: Campanha=X;Contato=Nome
   ```
5. **Em caso de erro**:
   ```
   Erro no envio. Backoff aplicado e job reagendado em Xms. Tentativa=1
   ```
6. **Após 5 tentativas falhas**:
   ```
   [CAMPAIGN FAILED] Campanha=X; Registro=Y; Tentativas=5
   ```

### Teste 5: Relatório Detalhado
1. Acesse uma campanha em andamento ou finalizada
2. Clique no ícone **Relatório** (documento)
3. Na página de relatório, clique em **"Relatório Detalhado"**
4. **Verificar**:
   - ✅ Sumário com totais por status
   - ✅ Tabela com lista de contatos
   - ✅ Coluna "Status" com ícones coloridos
   - ✅ Coluna "Tentativas" mostrando contador
   - ✅ Coluna "Último Erro" (se houver)
   - ✅ Filtros funcionando (por status e busca)
   - ✅ Paginação funcionando

### Teste 6: Filtros do Relatório Detalhado
1. No relatório detalhado
2. **Filtrar por Status**:
   - Selecione "Entregue" → deve mostrar só entregues
   - Selecione "Falhou" → deve mostrar só falhas
   - Selecione "Pendente" → deve mostrar só pendentes
3. **Buscar**:
   - Digite um número de telefone
   - Digite parte de uma mensagem
   - **Resultado**: Deve filtrar a tabela

### Teste 7: Limite de Tentativas
1. Crie uma campanha com número inválido ou desconectado
2. Inicie o envio
3. **Verificar nos logs**:
   ```
   Tentativa=1
   Tentativa=2
   Tentativa=3
   Tentativa=4
   Tentativa=5
   [CAMPAIGN FAILED] Falha após 5 tentativas
   ```
4. No relatório detalhado:
   - Status: **Falhou** (vermelho)
   - Tentativas: **5**
   - Último Erro: Mensagem do erro

---

## 🔍 VERIFICAÇÕES DE PERFORMANCE

### Monitorar Uso de CPU/Memória
```bash
# No Windows (PowerShell)
Get-Process node | Select-Object CPU, WorkingSet, ProcessName

# Verificar logs de erro
tail -f backend/logs/app.log | grep ERROR
```

### Verificar Fila de Jobs
```bash
# Acessar Redis (se disponível)
redis-cli
> KEYS *campaign*
> LLEN bull:CampaignQueue:*
```

### Sinais de Problema
- ❌ CPU acima de 80% por muito tempo
- ❌ Memória crescendo continuamente
- ❌ Logs com muitos erros consecutivos
- ❌ Campanhas travando no meio

---

## 🐛 TROUBLESHOOTING

### Erro: "column shipping.attempts does not exist"
**Solução**: Executar a migration
```bash
cd backend
npm run db:migrate
```

### Erro: Build falha com "Block-scoped variable used before declaration"
**Solução**: Já corrigido! Apenas execute `npm run build` novamente

### Relatório Detalhado não aparece
**Verificar**:
1. Rota está configurada? → Verificar `frontend/src/routes/index.js`
2. Botão aparece? → Verificar `frontend/src/pages/CampaignReport/index.js`
3. Console do navegador tem erros? → F12 → Console

### Campanha não retoma de onde parou
**Verificar**:
1. Logs do backend: `[RESTART CAMPAIGN] Enviados: X/Y`
2. Tabela `CampaignShipping`: `SELECT * FROM "CampaignShipping" WHERE "campaignId" = X AND "deliveredAt" IS NOT NULL`
3. Sistema deve pular registros com `deliveredAt` preenchido

---

## 📊 MÉTRICAS DE SUCESSO

### ✅ Tudo Funcionando
- Layout ocupa 100% da tela
- Campanhas pausadas podem ser editadas
- Campanhas retomam de onde pararam
- Máximo de 5 tentativas por contato
- Relatório detalhado mostra todos os dados
- Filtros e busca funcionando
- Performance estável (CPU < 50%, memória estável)

### ⚠️ Atenção Necessária
- CPU > 70% constante
- Memória crescendo
- Muitos erros nos logs
- Campanhas travando

### 🚨 Problema Crítico
- Backend crashando
- Migration não executada
- Erros de SQL
- Relatório não carrega

---

## 📝 CHECKLIST COMPLETO

- [ ] Migration executada com sucesso
- [ ] Backend reiniciado
- [ ] Layout da página de campanhas correto
- [ ] Edição de campanhas pausadas funciona
- [ ] Retomada de campanhas funciona
- [ ] Logs de monitoramento aparecem
- [ ] Limite de 5 tentativas funciona
- [ ] Relatório detalhado carrega
- [ ] Filtros do relatório funcionam
- [ ] Busca do relatório funciona
- [ ] Paginação funciona
- [ ] Performance estável
- [ ] Sem erros no console

---

**Data**: 26/10/2025  
**Versão**: 2.0  
**Status**: Pronto para testes
