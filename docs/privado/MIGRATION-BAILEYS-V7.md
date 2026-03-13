# Plano de Migração: Baileys v6.17.16 → v7.x

## 📊 Informações Gerais

**Versão atual:** 6.17.16  
**Versão alvo:** 7.1.x (última estável)  
**Tempo estimado:** 2-3 dias  
**Risco:** Médio-Alto (sessão WhatsApp pode precisar de re-pairing)

---

## ⚠️ Breaking Changes v7 (Resumo)

### 1. Auth State (CRÍTICO)
```typescript
// v6 - FUNCIONA
const { state, saveCreds } = useSingleFileAuthState('./auth.json')

// v7 - NOVO FORMATO
const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys')
// ou useSingleFileAuthState foi deprecado
```

### 2. Store API (MUDANÇA SIGNIFICATIVA)
```typescript
// v6
const store = makeInMemoryStore({ logger })
store.readFromFile('./store.json')
wbot.store = store

// v7 - Store é separado, não mais anexado ao socket
const store = useStore(wbot, { logger })
// ou useMemoryStore
```

### 3. Socket Initialization
```typescript
// v6
const sock = makeWASocket({ auth: state })

// v7
const sock = makeWASocket({ 
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger)
  }
})
```

### 4. Eventos (Mudanças de Nome)
| v6 | v7 |
|----|----|
| `connection.update` | `connection.update` (igual) |
| `creds.update` | `creds.update` (igual) |
| `messaging-history.set` | `messaging-history.set` (igual) |
| `chats.set` | `chats.set` (igual) |
| `contacts.set` | `contacts.set` (igual) |
| `messages.set` | `messages.set` (igual) |
| `chats.update` | `chats.update` (igual) |
| `presence.update` | `presence.update` (igual) |

**Eventos NOVOS na v7:**
- `lid-mapping.update` ✅ (Já usado no código - funcionará)
- `labels.association` 
- `labels.edit`

### 5. USyncQuery (NOVO - vai FUNCIONAR)
```typescript
// v7 - VAI FUNCIONAR (não existe na v6)
const { USyncQuery, USyncUser } = require("@whiskeysockets/baileys")
const query = new USyncQuery()
  .withMode("query")
  .withUser(new USyncUser().withId(lidJid))
  .withContactProtocol()
const result = await sock.executeUSyncQuery(query)
```

### 6. sendMessage API (Leve mudança)
```typescript
// v6
await sock.sendMessage(jid, { text: 'Hello' })

// v7 (ainda funciona, mas tem novas opções)
await sock.sendMessage(jid, { text: 'Hello' }, { 
  // novas opções de retry, etc
})
```

---

## 📁 Arquivos para Modificar

### 🔴 CRÍTICOS (Sistema não funciona sem)
1. `src/helpers/authState.ts` - Criação de auth state
2. `src/services/WbotServices/StartWhatsAppSessionUnified.ts` - Inicialização do socket
3. `src/services/WbotServices/wbotMessageListener.ts` - Uso do store

### 🟡 IMPORTANTES (Funcionalidade degradada sem)
4. `src/services/WbotServices/wbotMonitor.ts` - Monitoramento
5. `src/services/ContactResolution/ContactResolverService.ts` - USyncQuery funcionará
6. `src/helpers/ResolveSendJid.ts` - Resolução de JIDs

### 🟢 MENORES (Ajustes simples)
7. `src/services/WbotServices/GetGroupParticipantsService.ts`
8. `src/services/WbotServices/AutoAssociateLidsService.ts`
9. `src/services/ContactResolution/LidResolverService.ts`

---

## 📝 Passo a Passo da Migração

### FASE 1: Preparação (4 horas)

1. **Backup**
   ```bash
   # Backup do auth
   cp -r backend/.wwebjs_auth backend/.wwebjs_auth.backup
   
   # Backup do banco (contatos, tickets)
   pg_dump 9s76hm2 > 9s76hm2_backup_$(date +%Y%m%d).sql
   ```

2. **Criar branch**
   ```bash
   git checkout -b feat/baileys-v7-migration
   ```

3. **Atualizar package.json**
   ```json
   "@whiskeysockets/baileys": "^7.1.0"
   ```

4. **Limpar cache e node_modules**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### FASE 2: Core Changes (1 dia)

#### 2.1 `src/helpers/authState.ts`
```typescript
import { useMultiFileAuthState } from '@whiskeysockets/baileys'

export const createAuthState = async (whatsappId: number) => {
  const authDir = `./.wwebjs_auth/session-${whatsappId}`
  
  // v7 - Multi-file auth state
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  
  return { state, saveCreds }
}
```

#### 2.2 `StartWhatsAppSessionUnified.ts`
```typescript
import { 
  makeWASocket, 
  makeCacheableSignalKeyStore,
  Browsers 
} from '@whiskeysockets/baileys'

// ...

const { state, saveCreds } = await createAuthState(whatsappId)

const sock = makeWASocket({
  version: [2, 3000, 1015901307], // Ou deixe Baileys detectar
  logger: logger.child({ level: 'silent' }),
  printQRInTerminal: true,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger)
  },
  browser: Browsers.ubuntu('Chrome'), // Novo na v7
  generateHighQualityLinkPreview: true
})

// Evento creds.update
sock.ev.on('creds.update', saveCreds)

// Store - v7 style (separado)
const store = makeInMemoryStore({ logger })
store.bind(sock.ev)

// Expor store no wbot para compatibilidade
;(sock as any).store = store
```

#### 2.3 `wbotMessageListener.ts`
```typescript
// Verificar onde usa wbot.store
// Na v7, o store é separado, então precisa de ajuste:

// Antes (v6):
const contactData = wbot.store?.contacts?.[participantJid]

// Depois (v7) - store é separado, precisa passar store como parâmetro
// ou acessar via ev.on('contacts.update')
```

### FASE 3: Testes (1 dia)

#### 3.1 Checklist de Testes
- [ ] Conexão inicial (QR code)
- [ ] Reconexão automática
- [ ] Envio de mensagem texto
- [ ] Recebimento de mensagem texto
- [ ] Envio de mídia (imagem, vídeo, áudio)
- [ ] Recebimento de mídia
- [ ] Mensagens de grupo
- [ ] Resolução de LID → Número (CRÍTICO)
- [ ] Evento `lid-mapping.update` (CRÍTICO)
- [ ] USyncQuery funcionando (CRÍTICO)
- [ ] Envio de mensagens de template
- [ ] Botões e listas
- [ ] Reactions
- [ ] Edição de mensagens
- [ ] Deleção de mensagens

### FASE 4: Ajustes Finos (0.5 dia)

1. **LID Resolution** - Validar que agora funciona com USyncQuery
2. **Store persistence** - Salvar/recuperar store
3. **Performance** - Verificar se não há memory leaks
4. **Logs** - Ajustar níveis de log

---

## 🔧 Rollback Procedure

### Se algo der errado:

1. **Parar o backend**
   ```bash
   pm2 stop backend  # ou docker-compose down
   ```

2. **Restaurar código**
   ```bash
   git checkout main  # ou branch anterior
   git branch -D feat/baileys-v7-migration
   ```

3. **Restaurar dependências**
   ```bash
   rm -rf node_modules package-lock.json
   npm install  # instala v6 novamente
   ```

4. **Restaurar auth (se necessário)**
   ```bash
   rm -rf .wwebjs_auth/session-*
   cp -r .wwebjs_auth.backup/* .wwebjs_auth/
   ```

5. **Reconectar sessões** (pode precisar escanear QR novamente)

---

## 🎯 Benefícios Esperados após Migração

### ✅ Vai Melhorar:
1. **Resolução de LID** - USyncQuery vai funcionar → mais números resolvidos
2. **Estabilidade** - Menos crashes em long-running sessions
3. **Reconexão** - Mais rápida e confiável
4. **Multi-device** - Suporte oficial melhorado
5. **Memória** - Melhor gerenciamento de cache

### ⚠️ Riscos:
1. **Re-pairing necessário** - Algumas sessões podem precisar de QR code novamente
2. **Incompatibilidade** - Código legado pode quebrar
3. **Performance** - Pode ter regressão inicial até ajustes
4. **Tempo** - Pode levar mais tempo que o estimado

---

## 📞 Quando executar?

**Recomendação:** Executar em **período de baixo tráfego**
- Fim de semana
- Horário noturno (após 22h)
- Após backup completo

**NÃO executar se:**
- Está em meio a campanha ativa
- Não tem tempo para testes
- Não tem ambiente de staging

---

## ✅ Próximos Passos

1. **Decidir data** da migração
2. **Preparar ambiente de staging** para testes
3. **Criar branch** e começar FASE 1
4. **Comunicar usuários** sobre possível downtime

---

## 📚 Referências

- [Baileys v7 Changelog](https://github.com/WhiskeySockets/Baileys/releases)
- [Baileys v7 Documentation](https://github.com/WhiskeySockets/Baileys/tree/master/docs)
- [Migration Guide (se existir)](https://github.com/WhiskeySockets/Baileys/wiki)

---

**Criado em:** Mar 2, 2026  
**Versão:** 1.0  
**Responsável:** [A definir]
