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
    apiKey: Yup.string().nullable(),
    queueId: Yup.number().nullable(),
    maxMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_MESSAGES_MIN")
      .max(50, "ERR_PROMPT_MAX_MESSAGES_MAX"),
    model: Yup.string().oneOf(
      [
        "gpt-3.5-turbo-1106",
        "gpt-4o",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-pro"
      ],
      "ERR_PROMPT_MODEL_INVALID"
    ).nullable(),
    maxTokens: Yup.number()
      .min(10, "ERR_PROMPT_MAX_TOKENS_MIN")
      .max(4096, "ERR_PROMPT_MAX_TOKENS_MAX")
      .nullable(),
    temperature: Yup.number()
      .min(0, "ERR_PROMPT_TEMPERATURE_MIN")
      .max(1, "ERR_PROMPT_TEMPERATURE_MAX")
      .nullable(),
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