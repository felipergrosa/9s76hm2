// Hosts oficiais permitidos para chamadas a providers de IA — impede
// SSRF/exfiltração de apiKey via baseURL arbitrário salvo na integração
// ou enviado pelo cliente (test-providers, /ai/models).
const ALLOWED_MODELS_HOSTS = new Set([
  "api.openai.com",
  "api.deepseek.com",
  "api.x.ai",
  "generativelanguage.googleapis.com"
]);

export const AI_PROVIDER_DEFAULT_BASE_URL: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  grok: "https://api.x.ai/v1"
};

export const sanitizeProviderBaseURL = (raw: any, fallback: string): string => {
  try {
    if (!raw || typeof raw !== "string") return fallback;
    const u = new URL(raw);
    if (u.protocol !== "https:" || !ALLOWED_MODELS_HOSTS.has(u.hostname)) {
      return fallback;
    }
    return raw;
  } catch {
    return fallback;
  }
};

export default sanitizeProviderBaseURL;
