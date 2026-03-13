# 🚀 Guia de Deploy Manual - Docker Hub

## Objetivo

Este guia explica como buildar e subir as imagens Docker (frontend e backend) para o Docker Hub **manualmente**, sem usar GitHub Actions, mantendo sua estrutura de desenvolvimento original.

---

## ⚙️ Pré-requisitos

1. **Docker Desktop instalado e rodando**
2. **Conta no Docker Hub** (https://hub.docker.com)
3. **Autenticado no Docker Hub** via terminal

---

## 🔧 Configuração Inicial (Uma Vez)

### 1. Aplicar Configuração WSL2 (Evita Travamentos)

O arquivo `.wslconfig` já foi criado em `C:\Users\feliperosa\.wslconfig`.

**Para aplicar a configuração:**

```powershell
# Reiniciar WSL2
wsl --shutdown

# Aguardar 10 segundos
Start-Sleep -Seconds 10

# Iniciar Docker Desktop novamente
```

Isso limita o Docker/WSL2 a **6GB de RAM** e **4 processadores**, evitando que trave seu PC.

### 2. Fazer Login no Docker Hub

```powershell
docker login
```

Digite seu **username** (`felipergrosa`) e **password/token**.

---

## 🚀 Como Fazer Deploy

### Comando Principal (Build + Push Completo)

```powershell
.\deploy-docker.ps1
```

Este comando vai:
1. ✅ Verificar se Docker está rodando
2. ✅ Verificar autenticação no Docker Hub
3. ✅ Compilar frontend (5-10 min)
4. ✅ Compilar backend (5-10 min)
5. ✅ Fazer push de ambas as imagens
6. ✅ Incluir retry automático em caso de falha

---

## 📋 Opções Avançadas

### Apenas Frontend

```powershell
.\deploy-docker.ps1 -SkipBackend
```

### Apenas Backend

```powershell
.\deploy-docker.ps1 -SkipFrontend
```

### Build sem Push (Apenas Compilar)

```powershell
.\deploy-docker.ps1 -NoPush
```

### Combinações

```powershell
# Build apenas frontend sem push
.\deploy-docker.ps1 -SkipBackend -NoPush

# Build apenas backend e fazer push
.\deploy-docker.ps1 -SkipFrontend
```

---

## 🔄 Atualizar Produção (Portainer)

Após o push das imagens:

1. Acesse seu **Portainer**
2. Vá em **Stacks → 9s76hm2**
3. Clique em **"Update the stack"** ou **"Pull and redeploy"**
4. Aguarde o Portainer baixar as novas imagens e reiniciar os containers

---

## 🆘 Resolução de Problemas

### Docker Travado em "Starting the Docker Engine..."

```powershell
.\scripts\fix-docker-windows.ps1
```

Este script:
- Para processos do Docker Desktop
- Reinicia WSL2
- Inicia Docker novamente
- **NÃO apaga seus containers ou volumes**

### Erro "EOF" Durante Build

O script `deploy-docker.ps1` **já resolve isso** usando `docker build` padrão ao invés de `buildx`.

Se ainda ocorrer:
1. Feche o Docker Desktop
2. Execute `.\scripts\fix-docker-windows.ps1`
3. Aguarde 1 minuto
4. Execute `.\deploy-docker.ps1` novamente

### Erro "Cannot connect to Docker daemon"

```powershell
# Verificar se Docker está rodando
docker info

# Se não estiver, iniciar Docker Desktop manualmente
# Ou executar:
.\scripts\fix-docker-windows.ps1
```

### Build Muito Lento

O build é lento no Windows devido ao WSL2. Tempo normal:
- **Frontend:** 5-10 minutos
- **Backend:** 5-10 minutos
- **Total:** 10-20 minutos

Para acelerar builds futuros, mantenha o Docker Desktop aberto.

---

## 📊 Logs e Diagnóstico

### Ver Logs do Build

O script mostra automaticamente as últimas 20 linhas em caso de erro.

### Verificar Imagens Criadas

```powershell
docker images | Select-String "felipergrosa"
```

### Verificar Tamanho das Imagens

```powershell
docker images felipergrosa/9s76hm2-frontend:latest
docker images felipergrosa/9s76hm2-backend:latest
```

---

## ✅ Checklist de Deploy

- [ ] Docker Desktop está rodando
- [ ] Autenticado no Docker Hub (`docker login`)
- [ ] Código commitado (opcional, mas recomendado)
- [ ] Executar `.\deploy-docker.ps1`
- [ ] Aguardar conclusão (10-20 min)
- [ ] Atualizar stack no Portainer

---

## 🔐 Segurança

- **Nunca commite** suas credenciais do Docker Hub no Git
- Use **tokens de acesso** ao invés de senha (mais seguro)
- Para criar token: Docker Hub → Account Settings → Security → New Access Token

---

## 📝 Notas Importantes

1. **Não use `pnpm run docker:deploy:fast`** - ele usa buildx que causa erro EOF no Windows
2. **Use sempre `.\deploy-docker.ps1`** - solução robusta e testada
3. **Mantenha `.wslconfig`** - evita travamentos do Docker
4. **Não reinstale o Docker** se travar - use `fix-docker-windows.ps1`

---

## 🎯 Resumo Rápido

```powershell
# Deploy completo (comando único)
.\deploy-docker.ps1

# Se Docker travar
.\scripts\fix-docker-windows.ps1

# Verificar imagens
docker images | Select-String "felipergrosa"
```

---

**Pronto! Agora você tem um processo confiável de deploy manual. 🚀**
