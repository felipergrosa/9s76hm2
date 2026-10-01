---
name: browser-sessao-logada
description: Anexar o agent-browser ao Chrome já logado do usuário para operar painéis que exigem sessão validada (Meta for Developers, Business Manager, WhatsApp Manager, admin de produção). Use quando o usuário pedir para "abrir no meu navegador", "usar minha sessão logada", "configurar no painel da Meta", validar OAuth/webhook em produção, ou qualquer tarefa web que precise das credenciais/sessões do usuário sem pedir senha. Trigger: agent-browser anexado, navegador logado, sessão validada, attach chrome.
---

# Browser com sessão logada do usuário (agent-browser attach)

Receita validada para dirigir o **Chrome real do usuário** (sessões, cookies e logins intactos) sem pedir senha e sem perder abas/extensões. Ideal para painéis com login complexo/2FA: Meta for Developers, Business Manager, o próprio app em produção, etc.

## Regras de ouro (não negociáveis)

1. **Nunca** feche, navegue ou interaja com as abas do usuário — trabalhe sempre numa aba própria (`tab new`).
2. **Nunca** `close --all` ou `browser close` — a janela pertence ao usuário. No fim, feche só a sua aba (`tab close`).
3. Nunca digite senhas/2FA — se a sessão expirou, **peça ao usuário** para logar uma vez na janela aberta.
4. Avise o usuário para **não abrir o Chrome pelo atalho normal** enquanto você trabalha (duas instâncias no mesmo perfil conflitam).
5. `--remote-debugging-port` dá controle total ao navegador em localhost — use só na máquina do usuário, com permissão.

## Por que a junção (obrigatório em Chrome ≥136)

Chrome moderno **ignora `--remote-debugging-port` quando o `--user-data-dir` é o diretório padrão**. A saída validada: criar uma **junção** (symlink de diretório) para o `User Data` real — o path é "diferente" para a checagem, mas o conteúdo é o perfil real com todas as sessões.

**PITFALL REAL JÁ ENCONTRADO**: a junção deve apontar para a raiz `User Data` (que contém `Local State` + `Default` + `Profile N`). Apontar só para `Default` faz o Chrome regenerar o `Local State` → extensões são marcadas como adulteradas e removidas. Se acontecer, reinstale as extensões e corrija o target.

## Passo a passo (Windows)

```powershell
# 0) Checar se já existe debug ativo
curl -s http://localhost:9222/json/version   # respondeu? pule para o passo 3

# 1) Fechar TODO o Chrome (avisar o usuário antes — abas voltam ao reabrir)
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force

# 2) Junção para o User Data REAL (raiz — ver pitfall acima)
cmd /c mklink /J "C:\Temp\chrome-debug-profile" "$env:LOCALAPPDATA\Google\Chrome\User Data"

# 3) Relançar Chrome com debug, restaurando sessão e abas
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\Temp\chrome-debug-profile" `
  --restore-last-session `
  --profile-directory=Default
```

Escolha do `--profile-directory`: descubra qual perfil está logado no destino **sem abrir nada** — o arquivo `History` de cada perfil não é criptografado:

```bash
for d in "$LOCALAPPDATA/Google/Chrome/User Data"/*/; do
  prof=$(basename "$d")
  n=$(sqlite3 "$d/History" "SELECT count(*) FROM urls WHERE url LIKE '%developers.facebook.com%'" 2>/dev/null || echo 0)
  echo "$prof: $n visitas"
done
```

## Anexar e operar (loop do agente)

```bash
# Sessão nomeada + aba própria pinada (nunca a aba do usuário)
export AGENT_BROWSER_SESSION="meta-config"
agent-browser --cdp 9222 tab new "https://developers.facebook.com/apps" --pin-tab

# loop padrão
agent-browser snapshot -i          # ler refs @eN
agent-browser click @e3            # agir
agent-browser snapshot -i          # re-snapshot (refs expiram a cada mudança)

# se a página pedir login → PARE e peça ao usuário:
# "Sua sessão do Facebook expirou — faça login na janela do Chrome que abriu."
```

Se `tab new` falhar com `tab_gone`, rode `tab list` e selecione outra.

## Encerrar

```bash
agent-browser tab close            # só a SUA aba
# avisar: "Pode usar o Chrome normalmente. Para voltar 100% ao normal,
# feche essa janela e abra pelo atalho — sessões e abas estão intactas."
# (opcional) remover a junção: cmd /c rmdir "C:\Temp\chrome-debug-profile"
```

## Cheat-sheet — Meta for Developers (o que já foi feito neste projeto)

App `chats-nobre` (META_APP_ID no env do backend). Caminhos reais do painel:

| Tarefa | Caminho |
|---|---|
| App Secret | App → **Configurações → Básico** → "Chave Secreta do Aplicativo" → Exibir (NUNCA "Redefinir") |
| OAuth redirect | Produto **Facebook Login → Configurações** → "URIs de redirecionamento OAuth válidos" → `https://chatsapi.nobreluminarias.com.br/meta-oauth/callback` |
| Webhook WhatsApp | Produto **WhatsApp → Configuração** → Callback `https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp` + verify token; depois assinar campo **`messages`** na lista "Webhook fields" |
| Webhook Page/IG | Produto **Webhooks** → objetos `page`/`instagram` → Callback `https://chatsapi.nobreluminarias.com.br/webhook` + `VERIFY_TOKEN` do env |
| Data Access Renewal | banner vermelho no topo do app → fluxo "Allowed usage" → submeter |
| Instruções p/ revisor | App Review → instruções de teste (usuário de teste já criado: Meta Reviewer, id 18, admin, companyId=1) |

Diálogos de tour da Meta aparecem cobrindo a página — feche com "No thanks" / botão ✕ antes de agir.

## Validação pós-configuração (sempre)

A Meta só aceita salvar webhook se o endpoint responder certo. Prove com curl **exatamente** a chamada que ela faz:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=x"
# 200 = OK; 403 = VERIFY_TOKEN não bate; timeout = deploy/env não chegou

curl -s "https://chatsapi.nobreluminarias.com.br/version"   # confirme o commit deployado
```

Erros que a Meta exibe genéricos ("Something went wrong", `#1357010`) geralmente são do lado dela: app com "API access restricted" (renovação em revisão) ou modo dev — o servidor pode estar 100% certo.
