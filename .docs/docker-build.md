# Guia: Build e Publicação dos Dockerfiles

Este documento descreve como gerar as imagens Docker do Taktchat (frontend e backend) e publicá-las no Docker Hub utilizando os artefatos existentes no repositório.

## Pré-requisitos

- Docker instalado e em funcionamento.
- Credenciais ativas no Docker Hub (`docker login`).
- Repositório atualizado (`git pull origin main`).

## Estrutura dos Dockerfiles

| Projeto   | Dockerfile                        | Contexto de build          |
|-----------|-----------------------------------|----------------------------|
| Frontend  | `frontend/Dockerfile`             | Diretório `frontend/`      |
| Backend   | `backend/Dockerfile`              | Diretório `backend/`       |

Cada Dockerfile já contém o fluxo de build específico (install + build + imagem final). Basta apontar para o Dockerfile correto durante o `docker build`.

## Comandos manuais

### Frontend
```bash
docker build \
  -f frontend/Dockerfile \
  --build-arg REACT_APP_BACKEND_URL=https://taktchat-api.alivesolucoes.com.br \
  --build-arg REACT_APP_SOCKET_URL=https://taktchat-api.alivesolucoes.com.br \
  --build-arg PUBLIC_URL=https://taktchat.alivesolucoes.com.br \
  -t zanonalivesolucoes/taktchat-frontend:latest \
  frontend
```

> **Observação**: os argumentos possuem default (ambiente local), mas em produção precisam ser definidos para refletir o domínio correto. Outros argumentos opcionais: `REACT_APP_PRIMARY_COLOR`, `REACT_APP_PRIMARY_DARK`, `REACT_APP_FRONTEND_VERSION`.

### Backend
```bash
docker build \
  -f backend/Dockerfile \
  -t zanonalivesolucoes/taktchat-backend:latest \
  backend
```

Substitua `latest` pela tag desejada (ex.: `v1.2.3`). Após o build, publique:

```bash
docker push zanonalivesolucoes/taktchat-frontend:<tag>
docker push zanonalivesolucoes/taktchat-backend:<tag>
```

## Script automatizado

O repositório inclui `scripts/update-docker-images.sh`, que executa os dois builds e pushes na sequência.

Uso:
```bash
scripts/update-docker-images.sh [tag]
```

- `tag` é opcional (default `latest`).
- Você pode sobrescrever variáveis via ambiente:
  - `DOCKER_USER`
  - `FRONT_IMAGE`
  - `BACK_IMAGE`

Exemplo com tag customizada:
```bash
IMAGE_TAG=v2 scripts/update-docker-images.sh v2
```

## Boas práticas

- Antes de publicar, garanta que a `main` está atualizada.
- Use tags sem espaços e padronize (ex.: `yyyy.mm.dd`, `vX.Y.Z`).
- Após o push, considere testar o `docker pull` para validar se a imagem está acessível.

## Validação pós-push

Depois de publicar as imagens, execute esta checagem rápida diretamente do Docker Hub:

```bash
docker pull zanonalivesolucoes/taktchat-frontend:<tag>
docker run --rm zanonalivesolucoes/taktchat-frontend:<tag> node --version

docker pull zanonalivesolucoes/taktchat-backend:<tag>
docker run --rm zanonalivesolucoes/taktchat-backend:<tag> node --version
```

1. `docker pull` garante que o repositório remoto recebeu a tag e que ela está pública.
2. `docker run --rm` valida que o container inicializa sem erros básicos (substitua `node --version` pelo comando de health check de cada serviço, se necessário).
3. Opcional: rode `docker logs` durante o teste para capturar mensagens que precisem ser adicionadas aos guias de operação.

## Checklist de manutenção

- Revise periodicamente as tags no Docker Hub e remova imagens obsoletas para liberar espaço e evitar confusão.
- Sempre que publicar uma nova imagem, atualize o changelog interno/projeto ou o registro de releases.
- Caso a build falhe, limpe cache local com `docker builder prune` (se aplicável) e repita o processo.
- Documente quaisquer overrides de variáveis utilizados no `scripts/update-docker-images.sh` para facilitar reproduções futuras e handover entre equipes.

## Script rápido de publicação (`scripts/publish-vps.sh`)

- O script criado em `scripts/publish-vps.sh` automatiza o fluxo recomendado:
  1. Entra em `/home/zanonr/desenvolvimento/taktchat`.
  2. Garante que a branch `main` esteja atualizada (`git fetch`, `git checkout main`, `git pull --ff-only origin main`).
  3. Exporta as variáveis corretas de produção (`FRONT_PUBLIC_URL=https://taktchat.alivesolucoes.com.br`, `FRONT_BACKEND_URL` e `FRONT_SOCKET_URL` apontando para `https://taktchat-api.alivesolucoes.com.br`).
  4. Define `FORCE_REBUILD=true` e `DOCKER_BUILDKIT=0`, forçando `--no-cache --pull` nos builds executados por `scripts/update-docker-images.sh`.
  5. Executa `scripts/update-docker-images.sh <tag>` (padrão `latest`) para construir e publicar as imagens frontend/backend.
- Uso típico:

```bash
scripts/publish-vps.sh            # usa tag latest
scripts/publish-vps.sh v1.5.3     # gera imagens com tag específica
```

- O script depende de `docker login` já configurado e falhará caso existam mudanças locais não commitadas na branch atual (por conta do `git checkout main` + `set -e`).



