import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Prompt from "../../models/Prompt";
import ShowPromptService from "./ShowPromptService";

interface PromptData {
  name: string;
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  queueId?: number;
  maxMessages?: number;
  companyId: string | number;
  voice?: string;
  voiceKey?: string;
  voiceRegion?: string;
  model: string; // Model is now required
  attachments?: string; // JSON string
  integrationId?: number;
}

const CreatePromptService = async (promptData: PromptData): Promise<Prompt> => {
  const {
    name,
    apiKey,
    prompt,
    queueId,
    maxMessages,
    companyId,
    model,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    voice,
    voiceKey,
    voiceRegion,
    attachments,
    integrationId,
  } = promptData;

  // Validação flexível: aceita integrationId OU campos diretos OU config global
  const promptSchema = Yup.object().shape({
    name: Yup.string()
      .min(5, "ERR_PROMPT_NAME_MIN")
      .max(100, "ERR_PROMPT_NAME_MAX")
      .required("ERR_PROMPT_NAME_INVALID"),
    prompt: Yup.string()
      .min(50, "ERR_PROMPT_INTELLIGENCE_MIN")
      .required("ERR_PROMPT_INTELLIGENCE_INVALID"),
    queueId: Yup.number().required("ERR_PROMPT_QUEUEID_INVALID"),
    maxMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_MESSAGES_MIN")
      .max(50, "ERR_PROMPT_MAX_MESSAGES_MAX")
      .required("ERR_PROMPT_MAX_MESSAGES_INVALID"),
    companyId: Yup.number().required("ERR_PROMPT_companyId_INVALID"),
    
    // Campos opcionais: permite integrationId, config global ou valores diretos
    apiKey: Yup.string().nullable().notRequired(),
    model: Yup.string()
      .nullable()
      .notRequired()
      .test('valid-model', 'ERR_PROMPT_MODEL_INVALID', function(value) {
        // Se fornecido, deve ser um dos modelos válidos
        if (!value || value === null || value === '') return true;
        return ["gpt-3.5-turbo-1106", "gpt-4o", "gemini-2.0-pro", "gemini-2.0-flash"].includes(value);
      }),
    maxTokens: Yup.number()
      .nullable()
      .notRequired()
      .test('valid-tokens', 'ERR_PROMPT_MAX_TOKENS_RANGE', function(value) {
        // Se fornecido, deve estar no range válido
        if (!value || value === null) return true;
        return value >= 10 && value <= 4096;
      }),
    temperature: Yup.number()
      .nullable()
      .notRequired()
      .test('valid-temperature', 'ERR_PROMPT_TEMPERATURE_RANGE', function(value) {
        // Se fornecido, deve estar no range válido
        if (!value || value === null) return true;
        return value >= 0 && value <= 1;
      }),
    voice: Yup.string().when("model", {
      is: (val) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().required("ERR_PROMPT_VOICE_REQUIRED"),
      otherwise: Yup.string().notRequired(),
    }),
    integrationId: Yup.number().nullable().notRequired(),
  });

  try {
    await promptSchema.validate(
      {
        name,
        apiKey,
        prompt,
        queueId,
        maxMessages,
        companyId,
        model,
        maxTokens,
        temperature,
        voice,
        integrationId, // Incluir integrationId na validação
      },
      { abortEarly: false }
    );
  } catch (err) {
    throw new AppError(`${JSON.stringify(err, undefined, 2)}`);
  }

  let promptTable = await Prompt.create({
    name,
    apiKey,
    prompt,
    queueId,
    maxMessages,
    companyId,
    model,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    voice,
    voiceKey,
    voiceRegion,
    attachments,
    integrationId,
  });

  promptTable = await ShowPromptService({ promptId: promptTable.id, companyId });

  return promptTable;
};

export default CreatePromptService;