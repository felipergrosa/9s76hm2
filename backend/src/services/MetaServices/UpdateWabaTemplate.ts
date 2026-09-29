import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getMetaAxiosClient, throwMetaError } from "./metaApiClient";
import { validateTemplateComponents } from "./validateTemplateComponents";

interface UpdateWabaTemplateParams {
  whatsapp: Whatsapp;
  templateId: string;
  category?: string;
  components?: any[];
  parameterFormat?: string;
  messageSendTtlSeconds?: number;
}

interface UpdateWabaTemplateResult {
  success: boolean;
}

const VALID_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];

/**
 * Edita um template existente na Meta:
 * POST /{templateId} com { category?, components?, message_send_ttl_seconds? }
 *
 * Restrições da Meta (não verificáveis localmente):
 * - Só edita templates em APPROVED / REJECTED / PAUSED
 * - Categoria de template APPROVED não pode mudar
 * - Template APPROVED aceita no máximo 10 edições a cada 30 dias
 */
const UpdateWabaTemplate = async ({
  whatsapp,
  templateId,
  category,
  components,
  parameterFormat,
  messageSendTtlSeconds
}: UpdateWabaTemplateParams): Promise<UpdateWabaTemplateResult> => {
  const context = "UpdateWabaTemplate";

  if (!templateId) {
    throw new AppError("templateId é obrigatório", 400);
  }

  if (
    category === undefined &&
    components === undefined &&
    messageSendTtlSeconds === undefined
  ) {
    throw new AppError(
      "Informe ao menos um campo para editar (category, components ou messageSendTtlSeconds)",
      400
    );
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    throw new AppError(
      `category inválida: "${category}". Válidas: ${VALID_CATEGORIES.join(", ")}`,
      400
    );
  }

  // Se components vierem, validar com as mesmas regras de criação
  if (components !== undefined) {
    validateTemplateComponents(components, parameterFormat);
  }

  try {
    const client = getMetaAxiosClient(whatsapp);

    const body: Record<string, any> = {};
    if (category !== undefined) body.category = category;
    if (components !== undefined) body.components = components;
    if (messageSendTtlSeconds !== undefined) {
      body.message_send_ttl_seconds = messageSendTtlSeconds;
    }

    logger.info(
      `[${context}] Editando template ${templateId} ` +
        `(campos: ${Object.keys(body).join(", ")})`
    );

    const { data } = await client.post(`/${templateId}`, body);

    logger.info(`[${context}] Template ${templateId} editado com sucesso`);

    return { success: data?.success === true };
  } catch (error: any) {
    return throwMetaError(context, error);
  }
};

export default UpdateWabaTemplate;
