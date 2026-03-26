---
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
  - "**/*.jsx"
description: Regras específicas do projeto Whaticket/9s76hm2
---

# Whaticket Project Rules

## Arquitetura

### Backend (Node.js + TypeScript + Sequelize)
- **Models**: `backend/src/models/` - Definições Sequelize
- **Services**: `backend/src/services/` - Lógica de negócio
- **Controllers**: `backend/src/controllers/` - Endpoints REST
- **Migrations**: `backend/src/database/migrations/` - Alterações de schema

### Frontend (React + JavaScript)
- **Components**: `frontend/src/components/` - Componentes React
- **Pages**: `frontend/src/pages/` - Páginas principais
- **Hooks**: `frontend/src/hooks/` - Custom hooks

## Convenções

### Nomenclatura
- Substituir referências "Whaticket" por "9s76hm2" em documentação pública
- Comentários em português
- Respostas técnicas em português (pt-br)

### Banco de Dados
- **Migrations OBRIGATÓRIAS** para alterações de schema
- Usar constraints quando possível
- Paginação obrigatória em listagens
- Considerar concorrência e idempotência

### Segurança
- Validar entradas no backend
- Nunca confiar no frontend
- Nunca expor segredos ou tokens
- Usar variáveis de ambiente para credenciais
- Logs estruturados com contexto

### Socket.IO
- Namespace unificado: `/workspace-${companyId}`
- Transports: ["polling", "websocket"]

### Documentação
- Arquivos `.md` em `docs/privado/`
- Scripts auxiliares em `docs/privado/`
- Arquivos `.sql` em `backend/database/scripts/`

## Modos de Operação

- **N0 (Draft)**: Exploração rápida. Não pode quebrar build, vazar segredos ou destruir dados.
- **N1 (Production)**: Padrão. Código pronto para PR.
- **N2 (Critical)**: Envolve dinheiro, segurança, autenticação, autorização ou integridade de dados.

Se não informado, assumir N1.

## Fluxo de Trabalho

1. Declarar objetivo, entradas/saídas, edge cases e modo antes de codar
2. Projetar antes de implementar
3. Escolher a solução mais simples que funcione
4. Separação de responsabilidades: UI/Controller → Domínio → Infra/Data
5. Qualidade proporcional ao risco

## Proibições

- `git reset --hard`, `rm -rf` ou comandos similares
- Sobrescrever grandes blocos sem confirmação
- Criar pasta `markdown/` (foi removida, usar `docs/privado/`)
