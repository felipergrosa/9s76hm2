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

  const promptSchema = Yup.object().shape({
    name: Yup.string()
      .min(5, "ERR_PROMPT_NAME_MIN")
      .max(100, "ERR_PROMPT_NAME_MAX")
      .required("ERR_PROMPT_NAME_INVALID"),
    prompt: Yup.string()
      .min(50, "ERR_PROMPT_INTELLIGENCE_MIN")
      .required("ERR_PROMPT_INTELLIGENCE_INVALID"),
    apiKey: Yup.string().required("ERR_PROMPT_APIKEY_INVALID"),
    queueId: Yup.number().required("ERR_PROMPT_QUEUEID_INVALID"),
    maxMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_MESSAGES_MIN")
      .max(50, "ERR_PROMPT_MAX_MESSAGES_MAX")
      .required("ERR_PROMPT_MAX_MESSAGES_INVALID"),
    companyId: Yup.number().required("ERR_PROMPT_companyId_INVALID"),
    model: Yup.string()
      .oneOf(
        ["gpt-3.5-turbo-1106", "gpt-4o", "gemini-2.0-pro", "gemini-2.0-flash"],
        "ERR_PROMPT_MODEL_INVALID"
      )
      .required("ERR_PROMPT_MODEL_REQUIRED"),
    maxTokens: Yup.number()
      .min(10, "ERR_PROMPT_MAX_TOKENS_MIN")
      .max(4096, "ERR_PROMPT_MAX_TOKENS_MAX")
      .required("ERR_PROMPT_MAX_TOKENS_REQUIRED"),
    temperature: Yup.number()
      .min(0, "ERR_PROMPT_TEMPERATURE_MIN")
      .max(1, "ERR_PROMPT_TEMPERATURE_MAX")
      .required("ERR_PROMPT_TEMPERATURE_REQUIRED"),
    voice: Yup.string().when("model", {
      is: (val) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().required("ERR_PROMPT_VOICE_REQUIRED"),
      otherwise: Yup.string().notRequired(),
    }),
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