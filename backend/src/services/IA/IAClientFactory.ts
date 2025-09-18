import { IAClient } from "./IAClient";
import { Provider } from "./ResolveAIIntegrationService";
import OpenAIClient from "./providers/OpenAIClient";
import GeminiClient from "./providers/GeminiClient";

export default function IAClientFactory(provider: Provider, apiKey: string): IAClient {
  if (!apiKey) throw new Error("API key inválida para provedor de IA");
  try {
    console.log("[IA][factory] creating client", { provider });
  } catch {}
  switch (provider) {
    case "openai":
      return new OpenAIClient(apiKey);
    case "gemini":
      return new GeminiClient(apiKey);
    default:
      throw new Error(`Provedor de IA não suportado: ${String(provider)}`);
  }
}
