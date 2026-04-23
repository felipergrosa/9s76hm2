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
  // Access token de curta duração (reduzido de 3650d para 1h por segurança).
  expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-only-do-not-use-in-production",
  // Refresh token com 7 dias (reduzido de 3650d).
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
};
