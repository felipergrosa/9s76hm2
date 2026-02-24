## Análise do Teste de Envio @lid

### Teste Realizado: 24/02/2026 01:33

#### Caso 1: Contato com remoteJid normal (SUCESSO ✓)
- **Contato ID**: 3828
- **remoteJid**: `5519998938807@s.whatsapp.net`
- **number**: `5519998938807`
- **ResolveSendJid retornou**: `5519998938807@s.whatsapp.net` ✓
- **Resultado**: Mensagem enviada com sucesso (ID: 4305)

**Conclusão**: O `ResolveSendJid` funciona corretamente quando o `remoteJid` já é um número real.

---

### Contatos com @lid identificados no banco:

#### Tickets abertos que DEVEM funcionar:
1. **Ticket 255** (Bruna zanobio)
   - remoteJid: `5519991244679@s.whatsapp.net` ✓
   - lidJid: `267439107498000@lid`
   - Tem LidMapping: ✓
   
2. **Ticket 237** (Fernanda)
   - remoteJid: `5519991537045@s.whatsapp.net` ✓
   - lidJid: `28286721732770@lid`
   - Tem LidMapping: ✓

3. **Ticket 257** (Felipe Rosa)
   - remoteJid: `5519992461008@s.whatsapp.net` ✓
   - lidJid: `197044576743486@lid`
   - Tem LidMapping: ✓

#### Tickets que VÃO FALHAR (precisam de correção):

1. **Ticket 293** (Maiza Brucieri Rosa) ⚠️
   - remoteJid: `79121954660393@lid` ❌
   - number: `"Maiza Brucieri Rosa"` (nome no lugar do número!)
   - LidMapping: NÃO EXISTE
   - **Problema**: O campo `number` contém o nome, não o número real
   
2. **Ticket 300** (Felipe Rosa ID 6220) ⚠️
   - remoteJid: `255022357020825@lid` ❌
   - number: `"Felipe Rosa"` (nome no lugar do número!)
   - LidMapping: NÃO EXISTE
   - **Problema**: O campo `number` contém o nome, não o número real

---

### Causa Raiz do Problema

O `ResolveSendJid` tenta resolver na seguinte ordem:
1. Se remoteJid NÃO é @lid → usa diretamente ✓
2. Se remoteJid É @lid → tenta:
   a. Usar `contact.number` (se for numérico e não PENDING_)
   b. Buscar na tabela `LidMapping`
   c. Consultar Baileys socket
   d. Usar `canonicalNumber`
   e. **Fallback**: usar o LID mesmo (causa erro Bad MAC)

**Para os tickets 293 e 300**:
- O `number` está com o **nome do contato** em vez do número real
- Não existe LidMapping para esses LIDs
- Resultado: `ResolveSendJid` retorna o LID → erro "Bad MAC"

---

### Correção Necessária

Opção 1: **Corrigir os dados no banco**
```sql
-- Atualizar contatos com número incorreto
UPDATE "Contacts" 
SET "number" = 'NUMERO_REAL_AQUI'
WHERE id IN (6215, 6220);
```

Opção 2: **Buscar número via Baileys socket durante o envio**
Melhorar o `ResolveSendJid` para tentar resolver via Baileys quando o número é inválido.

Opção 3: **Criar LidMapping manualmente**
Se soubermos o número real correspondente ao LID.

---

### Recomendação

Testar envio para **Ticket 293 ou 300** para confirmar o erro, depois aplicar a correção.
