# Spec — Auditoria Mobile Nativo (9s76hm2)

Checklist para validar/corrigir telas admin e de lista em viewport mobile (`theme.breakpoints.down("sm")`, <600px). Referência de padrão de layout: `docs/privado/SPEC-LAYOUT-PADRAO.md` e `pages/ContactLists/index.js`.

## Regras obrigatórias

### 1. Listas e tabelas
- Tabelas `Table` devem ficar dentro de `desktopTableWrapper` (`display: none` em `down("sm")`).
- No mobile renderizar cards (`mobileList`): `display: grid; gap: 12px; padding: 12px` — ver `card`, `cardHeader`, `cardName` (ellipsis), `cardMeta`, `metaLabel`, `cardActions` em ContactLists.
- Exceção: dados genuinamente tabulares podem usar scroll horizontal CONTIDO (`overflowX: 'auto'` num wrapper com `maxWidth: '100%'`) — nunca deixar a página inteira rolar na horizontal.
- Colunas `TableCell` não podem ter larguras fixas que estouram viewport.

### 2. Touch targets
- Todo `IconButton`/botão de ação em card mobile: `minWidth: 44, minHeight: 44`.
- Botões de header/toolbar: `size="small"` + `minHeight: 36` mínimo.

### 3. Tipografia / overflow de texto
- Títulos de card e nomes: `whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'` + `minWidth: 0` no pai flex.
- Textos longos em cards: clamp (`WebkitLineClamp`) ou wrap normal — nunca expandir além da viewport.
- Chips/tags podem quebrar linha (`flexWrap: 'wrap'`).

### 4. Header e toolbar (padrão novo)
- Header dentro do `Paper` (`borderRadius: 12, border, padding: 0, overflow: 'hidden', flex column`) — Title + count + subtitle + `headerActions` com `flexWrap: 'wrap'`.
- Toolbar: `flexWrap: 'wrap'`, campos de busca `flex: '1 1 220px'` com `maxWidth` razoável — em mobile devem ocupar largura total e empilhar.
- Selects/filtros: sem `minWidth` fixo que estoure 360px; em mobile `flex: '1 1 100%'` quando fizer sentido.

### 5. Scroll
- Conteúdo longo deve rolar dentro do Paper (`flex: 1; overflowY: 'auto'` num container interno) ou usar `useWindowScroll` no `MainContainer` — nunca prender conteúdo com `overflow: hidden` sem área rolável (bug já corrigido em /tags).
- Página NUNCA pode ter scroll horizontal.

### 6. Modais / Dialogs
- `Dialog` em mobile: `fullWidth` + `maxWidth="sm"` ou `fullScreen` quando o conteúdo é formulário longo; `scroll="body"` ou conteúdo rolável; ações sempre visíveis.
- Grids de formulário: colunas devem virar 1 coluna em `down("sm")` (`xs={12}` ou flex-direction column).

### 7. Estados
- Loading skeleton e empty state devem aparecer no mobile também (não só dentro da tabela desktop).

### 8. Proibições
- Não remover funcionalidade existente (filtros, ações, calendário, bulk actions).
- Não deixar `sx`/style com `width`/`minWidth` > 100% em mobile.
- Não quebrar o build — `CI=true npx craco build` deve passar (warnings = erro).
- Comentários em pt-BR. Manter convenções MUI v4 (`makeStyles(theme => ...)`).

## Validação por tela
Para cada tela atribuída:
1. Ler o arquivo da página e componentes locais diretamente relacionados.
2. Auditar contra as regras 1–8 (viewport 375px mental).
3. Corrigir violações com mudanças mínimas — preferir classes no `useStyles` existente.
4. Se a tela já estiver 100%, apenas reportar "OK" sem mexer.
5. Reportar no final: tela → status (OK | corrigida) → lista de correções feitas.
