# Docker Desktop WSL2 - Problema dos Pipes e Solução Permanente

## 🔴 PROBLEMA

O Docker Desktop com WSL2 no Windows **perde intermitentemente os pipes de comunicação** com o host Windows, causando:

1. **Docker CLI não conecta**: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
2. **Port forwarding não funciona**: `localhost:5432`, `localhost:6379` não respondem
3. **Backend não conecta ao banco**: `SequelizeConnectionRefusedError`

## 🔍 CAUSA RAIZ

O Docker Desktop usa **pipes nomeados do Windows** (`\\.\pipe\dockerDesktopLinuxEngine`) para comunicação entre o host Windows e o WSL2. Esses pipes podem ser perdidos quando:

| Causa | Frequência | Descrição |
|-------|------------|-----------|
| **Suspensão/Hibernação do Windows** | Alta | Windows suspende processos, pipes são fechados |
| **Fast Startup (Inicialização Rápida)** | Alta | Windows não faz shutdown completo, estado inconsistente |
| **Atualização do Docker Desktop** | Média | Novos binários, pipes antigos são removidos |
| **Reinício do WSL2** | Média | `wsl --shutdown` mata pipes |
| **Antivírus/Firewall** | Baixa | Bloqueio de pipes nomeados |
| **Corrupção de memória** | Baixa | Processos Docker travam |

### Verificação de Fast Startup

```powershell
# Verificar se Fast Startup está habilitado
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name "HiberbootEnabled"

# Valor 0 = Desabilitado ✅
# Valor 1 = Habilitado ❌ (pode causar problemas)
```

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Script de Verificação Automática

**Arquivo**: `backend/scripts/check-docker-pipes.js`

```bash
# Verificar estado do Docker
npm run docker:check

# Corrigir automaticamente
npm run docker:fix
```

### 2. Integração no npm run dev

**Arquivo**: `backend/package.json`

O comando `npm run dev` agora executa automaticamente:
1. Verifica se os pipes existem
2. Verifica se a porta 5432 está acessível
3. Se falhar, reinicia o Docker Desktop automaticamente
4. Aguarda o Docker estabilizar
5. Só então inicia o backend

### 3. Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia backend com verificação automática do Docker |
| `npm run dev:no-check` | Inicia backend sem verificação (se certeza que Docker está OK) |
| `npm run docker:check` | Verifica estado do Docker Desktop |
| `npm run docker:fix` | Corrige problemas do Docker Desktop automaticamente |

## 🛡️ PREVENÇÃO

### Desabilitar Fast Startup (Recomendado)

1. Abra **Painel de Controle** → **Opções de Energia**
2. Clique em **Escolher a função dos botões de energia**
3. Clique em **Alterar configurações não disponíveis no momento**
4. Desmarque **Ligar inicialização rápida**
5. Salve as alterações

Ou via PowerShell (Admin):
```powershell
Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name "HiberbootEnabled" -Value 0
```

### Desabilitar Hibernação (Opcional)

```powershell
powercfg /hibernate off
```

### Configurar Docker Desktop para Reiniciar Automaticamente

O Docker Desktop já está configurado para iniciar com o Windows (HKCU\Run). Se os pipes somem, o script `dev-with-docker-check.js` reinicia automaticamente.

## 📊 FLUXO DE CORREÇÃO AUTOMÁTICA

```
npm run dev
    ↓
dev-with-docker-check.js
    ↓
Verifica pipe dockerDesktopLinuxEngine
    ↓
Verifica porta 5432 (postgres)
    ↓
┌─────────────────┐     ┌─────────────────┐
│   Tudo OK ✅    │ OU  │  Problema ❌    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ↓                       ↓
    Inicia backend         check-docker-pipes.js --auto-fix
                                ↓
                          Mata Docker Desktop
                                ↓
                          Aguarda fechar
                                ↓
                          Inicia Docker Desktop
                                ↓
                          Aguarda pipes criarem
                                ↓
                          Verifica novamente
                                ↓
                          ┌─────────────────┐
                          │   Sucesso ✅    │
                          └────────┬────────┘
                                   │
                                   ↓
                              Inicia backend
```

## ⚠️ SE O PROBLEMA PERSISTIR

### 1. Reiniciar Docker Desktop Manualmente

1. Feche o Docker Desktop (botão direito → Quit)
2. Aguarde 10 segundos
3. Abra o Docker Desktop novamente
4. Aguarde os containers subirem
5. Execute `npm run dev`

### 2. Reiniciar WSL2

```powershell
wsl --shutdown
# Aguarde 5 segundos
# Docker Desktop reiniciará automaticamente
```

### 3. Verificar Antivírus

Alguns antivírus bloqueiam pipes nomeados. Adicione exceção para:
- `C:\Program Files\Docker\Docker\Docker Desktop.exe`
- `\\.\pipe\dockerDesktopLinuxEngine`

### 4. Reinstalar Docker Desktop

Se o problema persistir frequentemente:
1. Desinstale o Docker Desktop
2. Delete a pasta `%APPDATA%\Docker`
3. Reinstale o Docker Desktop
4. Reconfigure os containers

## 📝 LOGS

Os scripts de verificação geram logs detalhados:

```
═══════════════════════════════════════════════════════════
  VERIFICAÇÃO DO DOCKER DESKTOP
═══════════════════════════════════════════════════════════

🔍 Verificando pipes do Docker Desktop...
  ✅ \\.\pipe\dockerDesktopLinuxEngine
  ✅ \\.\pipe\docker_engine
🔍 Verificando conexão com Docker CLI...
  ✅ Docker CLI conectado
🔍 Verificando portas do Docker...
  ✅ Porta 5432
  ✅ Porta 6379
  ✅ Porta 8080

📊 RESUMO:
  Pipes: ✅ OK
  Docker CLI: ✅ OK
  Portas: ✅ OK

✅ Docker Desktop funcionando corretamente!
```

## 🔗 REFERÊNCIAS

- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/wsl/)
- [Windows Named Pipes](https://docs.microsoft.com/en-us/windows/win32/ipc/named-pipes)
- [WSL2 Known Issues](https://github.com/microsoft/WSL/issues)
