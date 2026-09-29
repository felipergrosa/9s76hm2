# 9s76hm2 — Guia do projeto

## Validação obrigatória antes de cada entrega

Rodar **antes de commit/push** — replica o que o CI executa:

```powershell
./scripts/validate-deliver.ps1            # backend tsc + migrations + frontend build CI=true
./scripts/validate-deliver.ps1 -Docker    # inclui docker build do frontend (idêntico ao CI)
```

Checks individuais:

```powershell
cd backend; npx tsc --noEmit              # typecheck
node scripts/check-migrations.js          # nomes de tabela em migrations vs models
cd frontend; CI=true npx craco build      # warnings viram erro no CI (CRA)
cd backend; npx sequelize db:migrate      # aplicar migrations pendentes
```

## CI/CD

- `.github/workflows/docker-frontend2.yml` → `docker build ./frontend` em runner self-hosted
- `.github/workflows/docker-backend2.yml` → idem para o backend
- Frontend Dockerfile usa `npm ci` — `package-lock.json` DEVE estar sincronizado com `package.json` (rodar `npm install` local após mudar deps e commitar o lock)

## Convenções

- Migrations TS em `backend/src/database/migrations/` — sempre checar `tableName` real do model (ex.: `CampaignShipping` é singular, não `CampaignShippings`)
- Comentários em pt-BR; respostas em pt-BR
- `.md` internos em `docs/privado/`; `.sql` em `backend/database/scripts/`
- Isolamento por `companyId` em todas as queries; paginação em listagens

## Meta / WhatsApp API Oficial

- Custos: `pricing_analytics` (por mensagem, pós jul/2025) → `WabaPricingRates` (rate = Σcost/Σvolume por categoria) → `estimatedCost` carimbado em `CampaignShipping`/`Message`
- Cotação USD→BRL: `CompaniesSettings.usdToBrlRate` → env `USD_BRL_RATE` → 5.60
- Sync diário de tarifas: `handleWabaPricingSync` (cron 06:00 em queues.ts)
- Templates: cache local em `WhatsappTemplates` (`headerMediaPath` persiste mídia do header — `header_handle` da Meta é token opaco, não URL)
