import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Prompt from "../../models/Prompt";
import ShowPromptService from "./ShowPromptService";

interface PromptData {
  id?: number;
  name?: string;
  apiKey?: string;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  maxMessages?: number;
  companyId?: string | number;
  voice?: string;
  voiceKey?: string;
  voiceRegion?: string;
  model?: string;
  attachments?: string; // JSON string
  integrationId?: number;
}

interface Request {
  promptData: PromptData;
  promptId: string | number;
  companyId: string | number;
}

const UpdatePromptService = async ({
  promptId,
  promptData,
  companyId,
}: Request): Promise<Prompt> => {
  const promptTable = await ShowPromptService({ promptId, companyId });

  const promptSchema = Yup.object().shape({
    name: Yup.string()
      .min(5, "ERR_PROMPT_NAME_MIN")
      .max(100, "ERR_PROMPT_NAME_MAX"),
    prompt: Yup.string().min(50, "ERR_PROMPT_INTELLIGENCE_MIN"),
    apiKey: Yup.string().nullable().notRequired(),
    queueId: Yup.number().nullable().notRequired(),
    maxMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_MESSAGES_MIN")
      .max(50, "ERR_PROMPT_MAX_MESSAGES_MAX")
      .nullable()
      .notRequired(),
    // Campo model deve ser opcional para permitir uso de configuração global
    model: Yup.string()
      .nullable()
      .notRequired()
      .test("valid-model", "ERR_PROMPT_MODEL_INVALID", function (value) {
        // Se não for informado (null, undefined ou string vazia), considerar válido
        if (!value || value === null || value === "") return true;
        return [
          "gpt-3.5-turbo-1106",
          "gpt-4o",
          "gemini-1.5-flash",
          "gemini-1.5-pro",
          "gemini-2.0-flash",
          "gemini-2.0-pro",
        ].includes(value);
      }),
    maxTokens: Yup.number()
      .nullable()
      .notRequired()
      .test("valid-tokens", "ERR_PROMPT_MAX_TOKENS_MAX", function (value) {
        if (value === undefined || value === null) return true;
        return value >= 10 && value <= 4096;
      }),
    temperature: Yup.number()
      .nullable()
      .notRequired()
      .test("valid-temperature", "ERR_PROMPT_TEMPERATURE_MAX", function (value) {
        if (value === undefined || value === null) return true;
        return value >= 0 && value <= 1;
      }),
    voice: Yup.string().when("model", {
      is: (val) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().required("ERR_PROMPT_VOICE_REQUIRED"),
      otherwise: Yup.string().notRequired(),
    }),
    voiceKey: Yup.string().when("model", {
      is: (val) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().notRequired(),
      otherwise: Yup.string().notRequired(),
    }),
    voiceRegion: Yup.string().when("model", {
      is: (val) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().notRequired(),
      otherwise: Yup.string().notRequired(),
    }),
    integrationId: Yup.number().nullable().notRequired(),
  });

  try {
    await promptSchema.validate(promptData, { abortEarly: false });
  } catch (err) {
    throw new AppError(`${JSON.stringify(err, undefined, 2)}`);
  }

  await promptTable.update(promptData);
  await promptTable.reload();
  return promptTable;
};

export default UpdatePromptService;