import { IAClient } from "./IAClient";
import { Provider } from "./ResolveAIIntegrationService";
import OpenAIClient from "./providers/OpenAIClient";
import GeminiClient from "./providers/GeminiClient";
import sanitizeProviderBaseURL, { AI_PROVIDER_DEFAULT_BASE_URL } from "../../utils/aiProviderBaseUrl";

export default function IAClientFactory(
  provider: Provider,
  apiKey: string,
  baseURL?: string
): IAClient {
  if (!apiKey) throw new Error("API key inválida para provedor de IA");
  try {
    console.log("[IA][factory] creating client", { provider });
  } catch {}
  switch (provider) {
    case "openai":
      return new OpenAIClient(apiKey);
    case "gemini":
      return new GeminiClient(apiKey);
    // DeepSeek e Grok expõem API OpenAI-compatible — mesmo client,
    // trocando o baseURL (validado contra whitelist de hosts oficiais).
    case "deepseek":
    case "grok": {
      const safeBaseURL = sanitizeProviderBaseURL(baseURL, AI_PROVIDER_DEFAULT_BASE_URL[provider]);
      return new OpenAIClient(apiKey, safeBaseURL);
    }
    default:
      throw new Error(`Provedor de IA não suportado: ${String(provider)}`);
  }
}
