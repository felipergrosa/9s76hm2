import * as Yup from "yup";

import AppError from "../../errors/AppError";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowIntegrationService from "./ShowQueueIntegrationService";
import { encryptString } from "../../utils/crypto";

interface IntegrationData {
  type?: string;
  name?: string;
  projectName?: string;
  jsonContent?: string;
  language?: string;
  urlN8N?: string;
  typebotSlug?: string;
  typebotExpires?: number;
  typebotKeywordFinish?: string;
  typebotUnknownMessage?: string;
  typebotDelayMessage?: number;
  typebotKeywordRestart?: string;
  typebotRestartMessage?: string;
}

interface Request {
  integrationData: IntegrationData;
  integrationId: string;
  companyId: number;
}

const UpdateQueueIntegrationService = async ({
  integrationData,
  integrationId,
  companyId
}: Request): Promise<QueueIntegrations> => {
  const schema = Yup.object().shape({
    type: Yup.string().min(2),
    name: Yup.string().min(2)
  });

  const {
    type,
    name,
    projectName,
    jsonContent,
    language,
    urlN8N,
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage 
  } = integrationData;

  try {
    await schema.validate({ type, name, projectName, jsonContent, language, urlN8N });
  } catch (err) {
    throw new AppError(err.message);
  }

  const integration = await ShowIntegrationService(integrationId, companyId);

  // Campos sensíveis dentro do jsonContent — o controller serve esses
  // valores mascarados, então um valor mascarado/ausente não pode
  // sobrescrever a credencial real.
  const SECRET_FIELDS = ["apiKey", "key"];
  const isMasked = (v: any) =>
    typeof v !== "string" || v.length === 0 || v.includes("*");

  // Prepare jsonContent for persistence
  let jsonToPersist: string | undefined = jsonContent;
  const effectiveType = type || integration.type;
  try {
    const incoming = jsonContent ? JSON.parse(jsonContent) : {};
    const current = integration.jsonContent ? JSON.parse(integration.jsonContent) : {};

    for (const field of SECRET_FIELDS) {
      const incomingVal = incoming?.[field];
      if (isMasked(incomingVal)) {
        // Mantém o valor já persistido (mascarado/ausente nunca sobrescreve)
        incoming[field] = current?.[field];
      } else if (
        // Criptografa apiKey de providers de IA (antes só "openai")
        ["openai", "gemini", "deepseek", "grok"].includes(effectiveType) &&
        !String(incomingVal).startsWith("ENC::")
      ) {
        incoming[field] = encryptString(incomingVal);
      }
    }

    // Merge model and any other fields
    const merged = { ...current, ...incoming };
    jsonToPersist = JSON.stringify(merged);
  } catch (_) {
    // if parse fails, fallback to incoming string as-is
  }

  await integration.update({
    type,
    name,
    projectName,
    jsonContent: jsonToPersist,
    language,
    urlN8N,
    // companyId nunca é gravado a partir do request — o registro já foi
    // validado como pertencente ao tenant via ShowIntegrationService
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage 
  });

  return integration;
};

export default UpdateQueueIntegrationService;