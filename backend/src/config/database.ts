require("../bootstrap");
// são paulo timezone

// SSL condicional via variáveis de ambiente
const sslEnabled = String(process.env.DB_SSL || "").toLowerCase() === "true" || process.env.DB_SSL === "1";
const rejectUnauthorized = !(String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "false");

const config: any = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
    // freezeTableName: true
  },
  options: { requestTimeout: 600000, encrypt: true },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    // reduzir para evitar longos travamentos em produção
    max: parseInt(process.env.DB_RETRY_MAX || "10")
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 100,
    min: parseInt(process.env.DB_POOL_MIN) || 15,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000, // 60s para dar tempo de recuperar conexão
    idle: parseInt(process.env.DB_POOL_IDLE) || 300000, // 5min para liberar conexões ociosas mais rápido
    evict: parseInt(process.env.DB_POOL_EVICT) || 10000, // Verificar e remover conexões quebradas a cada 10s
    handleDisconnects: true // Reconectar automaticamente se a conexão cair
  },
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: 'America/Sao_Paulo',
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false
};

if (sslEnabled && (config.dialect === "postgres" || config.dialect === "postgresql")) {
  config.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized
    }
  };
}

module.exports = config;
