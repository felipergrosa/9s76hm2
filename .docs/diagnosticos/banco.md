# Diagnóstico - Conexão com Banco de Dados

## Mensagens retornadas pelo backend
Desde 15/11/2025 o backend traduz erros de conexão do Sequelize para mensagens amigáveis. Elas aparecem no response JSON (campo `error`) e nos logs do backend (campo `code`).

| Código (`code`)            | Mensagem (front)                                                                 | Como resolver                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `DB_INVALID_CREDENTIALS`  | `Credenciais inválidas para o banco de dados. Verifique usuário e senha.`        | Confirme `DB_USER`/`DB_PASS` na stack e atualize a senha do usuário correspondente no PostgreSQL.      |
| `DB_NOT_FOUND`            | `Banco de dados não encontrado...`                                               | Crie o banco definido em `DB_NAME` ou aponte para um banco existente.                                  |
| `DB_ROLE_NOT_FOUND`       | `Usuário do banco de dados não existe...`                                        | No PostgreSQL execute `CREATE USER <DB_USER> WITH PASSWORD '...';` e conceda acesso ao banco esperado. |
| `DB_CONNECTION_ERROR`     | `Não foi possível conectar ao banco de dados. Aguarde...`                       | Banco em recuperação, fora do ar ou com rede bloqueada. Verifique serviço, firewall e logs do Postgres.|

## Passos rápidos
1. Identifique o código retornado na API ou logs do backend.
2. Consulte a tabela acima para aplicar a correção.
3. Após ajustar, force o serviço backend a reiniciar (`docker service update --force taktchat_taktchat-backend`).
4. Valide com `PGPASSWORD=... psql -h <host> -U <user> -d <db>` se a conexão foi restabelecida.

> Para diagnósticos mais profundos, utilize `backend/src/utils/diagnose.ts` ou `docker exec -it <postgres_container> psql ...` conforme descrito na documentação de instalação.

