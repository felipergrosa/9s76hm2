# Mapa Mental: Fluxo de Permissões e Tags

## 🎯 Visão Geral

O sistema de permissões por tags substitui completamente o modelo ContactWallet (removido em 18/03/2026).

---

## 📊 Tipos de Tags (Hierarquia por Prefixo)

```
                         TAGS
                           │
    ┌──────────────┬───────┴───────┬──────────────┐
    │              │               │              │
# PESSOAL     ## GRUPO       ### REGIÃO      SEM #
(obrigatória) (complementar) (complementar) (transacional)
    │              │               │              │
#JOAO-SILVA  ##CLIENTES    ###NORTE        VIP
#MARIA       ##REPRESENTANTES ###SUL       ATIVO
    │              │               │              │
Vincula       Agrupa         Segmenta       Não afeta
contato a     contatos       por região     permissões
USUÁRIO       por perfil
```

### Regras de Prefixo:
| Prefixo | Tipo | Exemplo | Função |
|---------|------|---------|--------|
| `#` (1x) | Pessoal | #JOAO-SILVA | Vincula contato a usuário (obrigatória) |
| `##` (2x) | Grupo | ##CLIENTES | Agrupa contatos por perfil (complementar) |
| `###` (3x) | Região | ###NORTE | Segmenta por região (complementar) |
| Sem `#` | Transacional | VIP, ATIVO | Categorização livre (não afeta permissões) |

---

## 👤 Usuário ↔ Tag Pessoal (1:1)

```
USUÁRIO                          TAG PESSOAL
┌──────────────┐                ┌──────────────┐
│ João Silva   │ ◄────────────► │ #JOAO-SILVA  │
│              │      1:1       │ id: 15       │
│ allowedContact                │              │
│ Tags: [15]   │                │              │
└──────────────┘                └──────────────┘

Regra: Cada usuário tem EXATAMENTE 1 tag pessoal
(garantido pela migration 20260318000000)
```

---

## 📋 Contato ↔ Tags (N:N)

```
CONTATO: Maria Santos
┌─────────────────────────────┐
│ tags:                       │
│   #JOAO-SILVA  ← Tag pessoal (define "dono")
│   CLIENTE VIP  ← Tag comum
│   LEAD QUENTE  ← Tag comum
└─────────────────────────────┘

Tabela: ContactTags (contactId, tagId, companyId)

REGRA: Contato com tag #JOAO-SILVA pertence à "carteira" do João
```

---

## 🔐 Fluxo de Permissões

```
         REQUISIÇÃO (Listar contatos/tickets)
                      │
                      ▼
         GetUserPersonalTagContactIds
                      │
       ┌──────────────┼──────────────┐
       │              │              │
  SUPER ADMIN      ADMIN       USUÁRIO COMUM
       │              │              │
  hasWallet       hasWallet     hasWallet
  Restriction     Restriction   Restriction
  = false         = false       = true
       │              │              │
  Vê TUDO         Vê TUDO       Vê apenas
                               contatos com
                               sua tag pessoal
```

---

## 🎯 Regra de Visibilidade

**REGRA: Contato visível se tem TODAS as tags do usuário**

Exemplo - Usuário Fernanda tem: `[#FERNANDA-FREITAS, #REPRESENTANTES]`

| Contato | Tags | Resultado |
|---------|------|-----------|
| A | #FERNANDA-FREITAS, #REPRESENTANTES | ✅ APARECE |
| B | #REPRESENTANTES | ❌ NÃO (falta #FERNANDA-FREITAS) |
| C | #FERNANDA-FREITAS | ❌ NÃO (falta #REPRESENTANTES) |
| D | #BRUNA | ❌ NÃO (não tem nenhuma) |

**SQL:**
```sql
SELECT contactId FROM ContactTags
WHERE tagId IN (userAllowedContactTags)
GROUP BY contactId
HAVING COUNT(DISTINCT tagId) = userAllowedContactTags.length
```

---

## 🖥️ Frontend: Campo "Carteira"

```
┌─────────────────────────────────────────────┐
│ Carteira (Responsável)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ [JOAO SILVA] [x]  [MARIA SANTOS] [x]    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

COMPORTAMENTO:
1. Usuário seleciona "JOAO SILVA" no campo Carteira
2. Frontend adiciona tag #JOAO-SILVA ao contato
3. Backend salva ContactTag (contactId, tagId=#JOAO-SILVA)
4. João agora vê esse contato na sua lista

SINCRONIZAÇÃO BIDIRECIONAL:
- Selecionar usuário → adiciona tag pessoal
- Remover usuário → remove tag pessoal
- Adicionar tag # manualmente → aparece no campo Carteira
```

---

## 📊 Exibição de Tags no Frontend

```
CAMPO CARTEIRA          CAMPO TAGS
(tags com #)            (tags sem #)
┌─────────────┐         ┌─────────────┐
│ JOAO SILVA  │         │ CLIENTE VIP │
│ MARIA SANTOS│         │ LEAD QUENTE │
└─────────────┘         └─────────────┘

Regra: Tags que começam com # aparecem no campo Carteira
       Tags que NÃO começam com # aparecem no campo Tags
```

---

## 🔄 Arquivos Principais

### Backend
- `GetUserPersonalTagContactIds.ts` - Helper principal de permissões
- `ListContactsService.ts` - Usa helper para filtrar contatos
- `ListTicketsService.ts` - Usa helper para filtrar tickets
- `TicketController.ts` - Usa helper para permissões

### Frontend
- `ContactModal/index.js` - Campo Carteira sincroniza com tags #
- `ContactForm/index.js` - Mesmo comportamento
- `BulkEditContactsModal/index.js` - Edição em massa
- `ContactDrawer/index.js` - Exibe carteira

---

## ✅ Migração Concluída

| Item | Status |
|------|--------|
| Tabela ContactWallet removida | ✅ |
| GetUserWalletContactIds substituído | ✅ |
| SyncContactWalletsAndPersonalTagsService removido | ✅ |
| Frontend adaptado para tags # | ✅ |
| Migrations corrigidas | ✅ |
| Build backend | ✅ |
| Build frontend | ✅ |

---

*Documento gerado em 18/03/2026*
