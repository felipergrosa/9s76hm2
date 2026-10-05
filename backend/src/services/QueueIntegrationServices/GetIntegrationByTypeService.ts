import QueueIntegrations from "../../models/QueueIntegrations";
import { decryptString } from "../../utils/crypto";

interface Request {
  companyId: number;
  type: string;
}

export interface IntegrationResult {
  id: number;
  type: string;
  name: string;
  projectName?: string;
  jsonContent?: any; // parsed JSON if valid
  language?: string;
  urlN8N?: string;
}

const GetIntegrationByTypeService = async ({ companyId, type }: Request): Promise<IntegrationResult | null> => {
  const integration = await QueueIntegrations.findOne({
    where: { companyId, type },
    order: [["id", "DESC"]]
  });

  if (!integration) return null;

  let parsed: any = undefined;
  if (integration.jsonContent) {
    try {
      parsed = JSON.parse(integration.jsonContent);
      // Decripta apiKey criptografada ("ENC::...") para QUALQUER provider —
      // antes era só "openai", então chaves gemini/deepseek/grok gravadas
      // criptografadas saíam mascaradas e falhavam como "API key not valid".
      if (parsed?.apiKey && typeof parsed.apiKey === "string") {
        const val: string = parsed.apiKey;
        if (val.startsWith("ENC::")) {
          try {
            parsed.apiKey = decryptString(val);
          } catch (_) {
            // leave as-is if decryption fails
          }
        }
      }
    } catch (_) {
      parsed = undefined;
    }
  }

  return {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    projectName: integration.projectName,
    jsonContent: parsed,
    language: integration.language,
    urlN8N: integration.urlN8N
  };
};

export default GetIntegrationByTypeService;
