# 🧪 COMO TESTAR AGORA - Guia Rápido

## ✅ O Que Está Funcionando

### 1. 📱 Preview iPhone (100% Pronto)

**Testar:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm start
```

**Passos:**
1. Login no Whaticket
2. Admin → Campanhas → **Nova Campanha**
3. Preencher nome
4. **Olhar para a DIREITA** → Ver mockup iPhone! 🎉
5. Digitar na "Mensagem 1"
6. **Ver preview atualizando em tempo real**
7. Adicionar uma imagem
8. **Ver imagem no mockup**

**Resultado Esperado:**
```
✅ Mockup iPhone aparece à direita
✅ Mensagem aparece no preview
✅ Variáveis são processadas:
   {nome} → João Silva
   {email} → cliente@exemplo.com
✅ Mídias aparecem no preview
✅ Timestamp e check azul aparece
```

---

### 2. 📝 Templates Meta - Backend (Endpoint Pronto)

**Testar com curl:**
```bash
# Obter token (login)
TOKEN=$(curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin"}' \
  | jq -r '.token')

# Buscar templates (substituir 1 pelo ID da conexão)
curl http://localhost:8080/whatsapp/1/templates \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**Resultado Esperado:**
```json
{
  "templates": [
    {
      "id": "123456",
      "name": "boas_vindas",
      "language": "pt_BR",
      "status": "APPROVED",
      "category": "UTILITY",
      "components": [
        {
          "type": "BODY",
          "text": "Olá {{1}}, seja bem-vindo!"
        }
      ]
    }
  ]
}
```

**Se não tiver templates:**
```json
{
  "templates": []
}
```
*Normal se ainda não criou templates no Facebook*

---

### 3. 🤖 Assistente de IA (Já Funcionava)

**Testar:**
1. Nova Campanha
2. Clicar no ícone **✨** (Sparkles) ao lado da mensagem
3. Digitar: "ola bem vindo"
4. **Ver sugestão melhorada:**
   - "Olá! 👋 Seja muito bem-vindo! 😊"

**Resultado Esperado:**
```
✅ Popup do assistente abre
✅ Texto é melhorado automaticamente
✅ Pode aplicar, anexar ou substituir
✅ Emojis adicionados moderadamente
```

---

### 4. 🔄 Seleção Flexível de Conexões

**Testar:**
1. Nova Campanha
2. Rolar até "Estratégia de Envio"
3. **Ver 5 opções:**
   - 📱 Única conexão
   - 🎯 Rodízio personalizado
   - 🔄 Todas as conexões
   - 📱 Apenas Baileys
   - ✅ Apenas API Oficial

4. Selecionar "🎯 Rodízio personalizado"
5. **Ver Autocomplete aparecer**
6. Selecionar: Conexão A, Conexão C
7. **Ver preview mostrando ordem:** 1.A → 2.C → 1.A

**Resultado Esperado:**
```
✅ RadioGroup com 5 opções aparece
✅ Autocomplete só aparece em "Personalizado"
✅ Preview mostra ordem do rodízio
✅ Alerta se misturar Baileys + API
✅ Contadores corretos (X Baileys, Y API)
```

---

## 🔶 O Que Precisa Copiar (40min)

### Frontend Templates (15min)

**Arquivo:** `frontend/src/components/CampaignModal/index.js`

**O que fazer:**
1. Abrir `IMPLEMENTACAO_TEMPLATES_COMPLETO.md`
2. Copiar seção "3A: Templates Meta - Frontend"
3. Colar no `CampaignModal/index.js` nas linhas indicadas
4. Salvar
5. Frontend vai recarregar automaticamente

**Resultado:**
- Seletor de templates aparece quando API Oficial
- Lista templates aprovados
- Preview do template selecionado
- Botão para abrir Facebook Manager

---

### Botões Interativos (25min)

**Backend (10min):**
1. Criar arquivo: `backend/src/services/MetaServices/SendInteractiveMessage.ts`
2. Copiar código da seção "4.1"
3. Salvar
4. Reiniciar backend

**Frontend (15min):**
1. Abrir: `frontend/src/components/QueueModal/index.js`
2. Copiar código da seção "4.2"
3. Adicionar após `greetingMessage`
4. Salvar

**Resultado:**
- Checkbox "Usar botões" aparece em filas
- Adicionar até 3 botões
- Máx 20 caracteres por botão
- Preview dos botões

---

## 🐛 Troubleshooting

### Preview não aparece:
```bash
# 1. Verificar console do navegador (F12)
# 2. Verificar import do WhatsAppPreview
# 3. Limpar cache: Ctrl+Shift+R

# Se erro de import:
cd frontend
npm install
npm start
```

### Endpoint de templates retorna 404:
```bash
# 1. Verificar rota foi adicionada
# 2. Reiniciar backend
cd backend
npm run dev

# 3. Verificar logs
# Deve aparecer: [GetApprovedTemplates] Buscando templates...
```

### Assistente não abre:
```bash
# 1. Verificar se OpenAI/Gemini está configurado
# Admin → Integrações → OpenAI/Gemini

# 2. Ver console (F12)
# Se erro 404: configuração não encontrada
```

---

## 📊 Checklist de Teste

### Preview iPhone:
- [ ] Mockup aparece à direita
- [ ] Mensagem atualiza em tempo real
- [ ] Variáveis são processadas
- [ ] Imagens aparecem
- [ ] Múltiplas mensagens aparecem em sequência
- [ ] Timestamp e checks aparecem

### Backend Templates:
- [ ] Endpoint `/whatsapp/:id/templates` responde
- [ ] Retorna array de templates
- [ ] Templates têm `id`, `name`, `status`
- [ ] Se não tiver, retorna array vazio (OK)

### Seleção de Conexões:
- [ ] RadioGroup com 5 opções
- [ ] "Personalizado" mostra Autocomplete
- [ ] Preview mostra ordem correta
- [ ] Alerta aparece ao misturar tipos
- [ ] Salva `allowedWhatsappIds` corretamente

### Assistente IA:
- [ ] Ícone ✨ aparece
- [ ] Popup abre ao clicar
- [ ] Texto é melhorado
- [ ] Pode aplicar/anexar/substituir
- [ ] Context="campaign" está correto

---

## 🎯 Teste Completo End-to-End

### Cenário: Criar Campanha com Preview

```bash
1. Login
2. Nova Campanha
3. Nome: "Teste Preview"
4. Mensagem 1: "Olá {nome}!"
5. ✅ Ver no preview: "Olá João Silva!"
6. Adicionar imagem
7. ✅ Ver imagem no mockup
8. Selecionar "Rodízio Personalizado"
9. Escolher 2 conexões
10. ✅ Ver preview da ordem
11. Salvar
12. ✅ Campanha criada com sucesso!
```

**Tempo:** 2 minutos  
**Resultado:** Campanha funcional com preview perfeito! 🎉

---

## 📞 Se Algo Der Errado

1. **Verificar logs do backend:**
   ```bash
   # Ver terminal do backend
   # Procurar por erros em vermelho
   ```

2. **Verificar console do navegador:**
   ```bash
   # F12 → Console
   # Ver se há erros em vermelho
   ```

3. **Limpar cache:**
   ```bash
   # Navegador: Ctrl+Shift+R (Windows)
   # Ou: Cmd+Shift+R (Mac)
   ```

4. **Reinstalar dependências:**
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   npm start
   ```

---

## 🎉 Sucesso!

Se você ver:
- ✅ Mockup iPhone à direita
- ✅ Preview atualizando
- ✅ Endpoint de templates respondendo
- ✅ Assistente melhorando textos
- ✅ Seleção flexível funcionando

**Parabéns! Está tudo funcionando!** 🚀

---

**Próximo passo:** Copiar código dos templates e botões (40min) ou usar assim mesmo e copiar depois! 😊
