# Spec — Padrão de layout de páginas de listagem (referência: `frontend/src/pages/Connections/index.js`)

Aplicar este padrão de ESTRUTURA VISUAL às páginas de listagem. Preservar 100% do comportamento funcional (hooks, endpoints, modais, permissões, sockets).

## Estrutura-alvo

```jsx
return (
  <MainContainer>
    {/* ...modais existentes da página... */}
    {!hasPermission("<perm>.view") ? <ForbiddenPage /> : (
      <Paper className={classes.paper} variant="outlined">
        {/* 1. Cabeçalho */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>{título} ({total})</Title>
            <span className={classes.subtitle}>{subtítulo descritivo em pt-BR}</span>
          </div>
          <div className={classes.headerActions}>
            {/* ações primárias da página (Novo, Exportar etc.) — Button variant="contained" size="small" startIcon={<LucideIcon size={16} />} style={{ minHeight: 36 }} */}
          </div>
        </div>

        {/* 2. Toolbar de busca/filtros */}
        <div className={classes.toolbar}>
          <TextField className={classes.searchField} size="small" variant="outlined"
            placeholder="Buscar…" value={searchParam} onChange={...}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon size={16} /></InputAdornment> }} />
          {/* filtros: <FormControl size="small" variant="outlined" className={classes.filterSelect}><Select native displayEmpty>…</Select></FormControl> */}
        </div>

        {/* 3. Conteúdo */}
        {loading ? (
          <Table><TableBody><TableRowSkeleton columns={N} /></TableBody></Table>
        ) : items.length === 0 ? (
          <div className={classes.emptyState}>
            <Icone size={44} style={{ color: theme.palette.text.disabled }} />
            <div>Nenhum registro encontrado.</div>
          </div>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className={classes.mobileList}>{items.map(item => <div className={classes.card}>…</div>)}</div>
            {/* Tabela — desktop */}
            <div className={classes.desktopTableWrapper}>
              <Table>
                <TableHead><TableRow>{/* TableCell className={classes.headCell} */}</TableRow></TableHead>
                <TableBody>{items.map(item => <TableRow className={classes.rowHover}>…</TableRow>)}</TableBody>
              </Table>
            </div>
          </>
        )}
      </Paper>
    )}
  </MainContainer>
);
```

## Bloco de estilos padrão (copiar de `Connections/index.js`, ajustando o que não se aplicar)

Chaves obrigatórias do `useStyles`: `paper`, `header`, `headerText`, `subtitle`, `headerActions`, `toolbar`, `searchField`, `filterSelect`, `headCell`, `bodyCell`, `rowHover`, `actionsCell`, `emptyState`, `mobileList`, `desktopTableWrapper`, `card`, `cardHeader`, `cardTitle`, `cardName`, `cardMeta`, `metaLabel`, `metaValue`, `cardActions`, `actionButton`.

## Regras

- Ícones de ação: `lucide-react` (`size={18}`) dentro de `IconButton size="small"`.
- Chips/status: classes tailwind `px-2 py-0.5 rounded-full text-xs font-medium bg-…` (tailwind já está no projeto).
- Paginação existente (server-side ou `TablePagination`) DEVE ser preservada — colocar dentro do `Paper`, após a tabela/cards.
- Se a página já usa busca server-side, manter (ligar o `TextField` de busca no mesmo handler/state, com debounce se já existir).
- Filtros client-side: usar `useMemo` para `sortedItems`/`filteredItems` como em Connections.
- Se a página não for uma lista/tabela (ex.: `/chats` é chat, `/flowbuilders` pode ser grid), aplicar **proporcionalmente**: pelo menos `MainContainer` + `Paper` + `header` (Title+subtitle+actions) + `toolbar` de busca quando fizer sentido. NÃO forçar tabela onde não cabe.
- Permissões existentes (`usePermissions`, `ForbiddenPage`) e gates por plano devem ser preservados exatamente.
- Manter todos os `i18n.t()` existentes; só adicionar texto literal em pt-BR para subtitle.
- Comentários em pt-BR. Não criar novos arquivos de página.
- Rodar `cd frontend && CI=true npx craco build` não é exigido por agente (validação central depois), mas o código deve compilar: imports usados presentes, sem variáveis não usadas (CI trata warning como erro — remover imports órfãos!).
