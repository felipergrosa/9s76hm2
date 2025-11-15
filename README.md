Copyright

## Taktchat

Plataforma de mensageria omnichannel voltada para operações de atendimento e campanhas no WhatsApp. Este repositório reúne backend (Node.js/TypeScript), frontend (React/CRACO) e automações de infraestrutura.

### Stack principal

- **Backend**: Node.js 22, Express, Sequelize, Bull/Redis, Socket.IO.
- **Frontend**: React 17, Material UI, CRACO.
- **Infraestrutura**: PostgreSQL 15, Redis 6.2, Docker Compose.

### Funcionalidades em alto nível

- Atendimento omnichannel com múltiplas filas, Kanban, tags e automações anti-ban.
- Campanhas segmentadas, Flow Builder visual, integrações com bots/IA e controle de cadência.
- Contatos, listas, arquivos inteligentes, dashboards e relatórios operacionais.
- Multi-empresa nativa, perfis e permissões granulares, painel financeiro e billing.
- Webhooks, APIs externas, monitoramento (audit logs, announcements) e recursos de AI/RAG.

> Detalhamento completo: `.docs/visao-geral/funcionalidades.md`.

### Início rápido

```bash
git clone <repo>
cd taktchat

# Subir banco e cache (caso já exista Postgres local, use POSTGRES_HOST_PORT=5433)
docker compose up -d postgres redis

# Ajuste DB_PORT no backend/.env se usar porta alternativa

# Backend
cd backend
npm install
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm start
```

Consulte `.docs/instalacao/` para requisitos e variações (Docker completo, produção, etc.).

### Documentação

Toda a documentação foi reorganizada em `.docs/`. Principais pontos de entrada:

- Visão geral do produto: `.docs/visao-geral/produto.md`
- Arquitetura e fluxos críticos: `.docs/visao-geral/arquitetura.md` e `.docs/visao-geral/fluxos-criticos.md`
- Instalação e ambientes: `.docs/instalacao/`
- Variáveis de ambiente e segurança: `.docs/configuracao/`
- Operação, monitoramento e suporte: `.docs/operacao/`
- Funcionalidades por módulo: `.docs/funcionalidades/`
- Procedimentos de diagnóstico: `.docs/diagnosticos/`
- Diagnóstico de banco (erros DB_* do backend): `.docs/diagnosticos/banco.md`
- Checklists e histórico: `.docs/anexos/`
- Scripts SQL organizados: `.docs/sql/`
- Build/publicação de imagens Docker: `.docs/docker-build.md`
- Script rápido para publicar imagens na VPS (forçando rebuild e `PUBLIC_URL` correto): `scripts/publish-vps.sh` (detalhes em `.docs/docker-build.md`).

Documentos anteriores permanecem disponíveis como referência em `.docs/legacy/`.

### Contribuição

- Utilize arquivos de análise em `.docs/branchs/<nome-da-branch>/` para descrever escopo antes de desenvolver.
- Siga convenções de código (ESLint/Prettier) e mantenha testes atualizados.
- Atualize a documentação ao entregar novas funcionalidades ou processos.

### Contato e suporte

- Em caso de incidentes, registre em `.docs/anexos/incidentes.md` e comunique os responsáveis pela operação.
- Para dúvidas sobre arquitetura ou integrações externas, consulte `.docs/infraestrutura/`.