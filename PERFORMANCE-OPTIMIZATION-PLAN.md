# Plano de Otimização de Performance - Loading Screens

## Objetivo
Eliminar telas brancas de loading que aparecem a cada navegação, tornando o sistema mais produtivo e responsivo.

## Problemas Identificados

### 1. AuthContext Loading (CRÍTICO)
- **Arquivo**: `frontend/src/hooks/useAuth.js/index.js`
- **Problema**: `loading` inicia como `true` e bloqueia toda a UI até refresh token completar
- **Impacto**: Aparece em TODAS as rotas via `Route.js`
- **Solução**: Otimizar lógica de autenticação para não bloquear UI

### 2. Layout Loading
- **Arquivo**: `frontend/src/layout/index.js`
- **Problema**: Mostra BackdropLoading enquanto carrega dados do layout
- **Impacto**: Aparece em toda navegação interna
- **Solução**: Usar skeleton screen ou carregar dados em background

### 3. Páginas com loading=true inicial
- **Arquivos**: Múltiplas páginas (Users, Tags, Queues, Reports, etc.)
- **Problema**: Cada página inicia com `loading: true` e mostra tela branca
- **Impacto**: Aparece ao navegar para qualquer página
- **Solução**: Usar skeleton screens + cache de dados

## Estratégias de Otimização

### Fase 1: Otimizar AuthContext (PRIORIDADE ALTA)
**Objetivo**: Remover loading desnecessário após autenticação inicial

**Mudanças**:
1. Mudar `loading` inicial de `true` para `false`
2. Usar flag separada `isInitializing` apenas para primeira carga
3. Remover `BackdropLoading` de `Route.js` para navegações subsequentes
4. Manter validação de auth sem bloquear UI

**Impacto esperado**: Elimina 80% dos loading screens

### Fase 2: Implementar Skeleton Screens
**Objetivo**: Substituir telas brancas por skeletons que mostram estrutura da página

**Mudanças**:
1. Criar componentes Skeleton para cada tipo de página:
   - `TableSkeleton` (listas)
   - `FormSkeleton` (formulários)
   - `DashboardSkeleton` (dashboards)
2. Substituir `BackdropLoading` por skeletons apropriados
3. Manter conteúdo parcial visível durante carregamento

**Impacto esperado**: Melhora percepção de velocidade em 60%

### Fase 3: Cache e Prefetch de Dados
**Objetivo**: Carregar dados instantaneamente usando cache

**Mudanças**:
1. Implementar cache de dados com React Query ou SWR
2. Persistir dados no localStorage para carregamento instantâneo
3. Implementar prefetch de páginas comuns
4. Usar stale-while-revalidate pattern

**Impacto esperado**: Carregamento instantâneo em 90% das navegações

### Fase 4: Otimizações de Backend
**Objetivo**: Reduzir tempo de resposta das APIs

**Mudanças**:
1. Adicionar índices em queries lentas
2. Implementar paginação eficiente
3. Reduzir dados retornados (apenas campos necessários)
4. Implementar cache no backend (Redis)

**Impacto esperado**: Reduz tempo de resposta em 50%

## Implementação

### Prioridade 1 (Impacto Imediato)
- [ ] Otimizar AuthContext loading
- [ ] Remover BackdropLoading de navegações internas
- [ ] Adicionar skeleton screens em páginas principais

### Prioridade 2 (Médio Prazo)
- [ ] Implementar cache com React Query
- [ ] Prefetch de dados comuns
- [ ] Otimizar queries do backend

### Prioridade 3 (Longo Prazo)
- [ ] Implementar Service Worker para cache offline
- [ ] Lazy loading de componentes pesados
- [ ] Code splitting otimizado

## Métricas de Sucesso

**Antes**:
- Loading screen aparece em 100% das navegações
- Tempo médio de loading: 1-3 segundos
- Tela branca visível

**Depois (Meta)**:
- Loading screen apenas no primeiro acesso
- Tempo médio de loading: <200ms
- Skeleton screens ou conteúdo imediato
- Navegação instantânea com dados em cache

## Notas Técnicas

### Padrão Atual (Problemático)
```javascript
const [loading, setLoading] = useState(true); // ❌ Bloqueia UI
useEffect(() => {
  fetchData().finally(() => setLoading(false));
}, []);

if (loading) return <BackdropLoading />; // ❌ Tela branca
```

### Padrão Otimizado (Recomendado)
```javascript
const [loading, setLoading] = useState(false); // ✅ Não bloqueia
const [data, setData] = useState(cachedData || []); // ✅ Cache

useEffect(() => {
  setLoading(true);
  fetchData().then(setData).finally(() => setLoading(false));
}, []);

return (
  <>
    {loading && data.length === 0 ? (
      <TableSkeleton /> // ✅ Skeleton em vez de branco
    ) : (
      <Table data={data} loading={loading} /> // ✅ Mostra dados + loading
    )}
  </>
);
```

## Referências

- React Query: https://tanstack.com/query/latest
- Skeleton Screens: https://mui.com/material-ui/react-skeleton/
- Performance Best Practices: https://web.dev/vitals/
