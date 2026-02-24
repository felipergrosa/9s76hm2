#!/bin/sh
set -e

echo "[auto-migrate] Inicializando startup com auto-migration..."

# Controla se deve rodar migrations automaticamente (default: true)
if [ "${AUTO_MIGRATE:-true}" != "true" ]; then
  echo "[auto-migrate] AUTO_MIGRATE != true -> iniciando apenas o servidor."
  exec node dist/server.js
fi

# Aguarda o banco ficar acessível tentando o status das migrations
ATTEMPTS=${DB_WAIT_ATTEMPTS:-30}
SLEEP_SECONDS=${DB_WAIT_SLEEP_SECONDS:-5}

i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if npx sequelize db:migrate:status >/dev/null 2>&1; then
    echo "[auto-migrate] Banco acessível."
    break
  fi
  echo "[auto-migrate] Banco ainda não acessível ($i/$ATTEMPTS). Tentando novamente em ${SLEEP_SECONDS}s..."
  i=$((i + 1))
  sleep "$SLEEP_SECONDS"
done

if [ "$i" -gt "$ATTEMPTS" ]; then
  echo "[auto-migrate] Aviso: Banco não respondeu após $ATTEMPTS tentativas. Prosseguindo mesmo assim."
fi

# Aplica migrations (idempotente: se não houver novas, não fará nada)
echo "[auto-migrate] Executando migrations..."
if ! npx sequelize db:migrate; then
  echo "[auto-migrate] ERRO: Falha ao aplicar migrations."
  npx sequelize db:migrate
  echo "[auto-migrate] Verifique logs/variáveis de ambiente. Prosseguindo com start do servidor."
fi

# Inicia a aplicação
echo "[auto-migrate] Iniciando servidor..."
exec node dist/server.js
