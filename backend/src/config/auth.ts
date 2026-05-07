// Validação obrigatória de segredos em produção (falha explícita ao subir).
// Em desenvolvimento permite fallback apenas para não travar setup local.
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  if (!process.env.JWT_SECRET) {
    throw new Error("[SECURITY] JWT_SECRET não definido em produção. Configure a variável de ambiente.");
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("[SECURITY] JWT_REFRESH_SECRET não definido em produção. Configure a variável de ambiente.");
  }
}

export default {
  // Fallback apenas em desenvolvimento; produção falha no startup (acima).
  secret: process.env.JWT_SECRET || "dev-only-do-not-use-in-production",
  // Access token: 12h por padrão (era 3650d, depois 1h). 1h era curto demais e
  // gerava 401/404 frequentes em sessões com inatividade (refresh nem sempre roda
  // a tempo em jobs de background, sockets e polling).
  expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-only-do-not-use-in-production",
  // Refresh token: 30 dias (refresh roda em segundo plano, não há motivo para curto).
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d"
};
