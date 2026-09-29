import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getMetaAxiosClient, throwMetaError } from "./metaApiClient";
import { validateTemplatePayload } from "./validateTemplateComponents";

interface CreateWabaTemplateParams {
  whatsapp: Whatsapp;
  name: string;
  category: string;
  language: string;
  parameterFormat?: string;
  components: any[];
  allowCategoryChange?: boolean;
  messageSendTtlSeconds?: number;
}

interface CreateWabaTemplateResult {
  id: string;
  status: string;
}

/**
 * Cria um template na Meta:
 * POST /{wabaId}/message_templates
 *
 * O payload é validado localmente antes da chamada para evitar
 * erros óbvios (limites de caracteres, exemplos obrigatórios etc).
 */
const CreateWabaTemplate = async ({
  whatsapp,
  name,
  category,
  language,
  parameterFormat,
  components,
  allowCategoryChange,
  messageSendTtlSeconds
}: CreateWabaTemplateParams): Promise<CreateWabaTemplateResult> => {
  const context = "CreateWabaTemplate";

  // Validação prévia completa (nome, categoria, componentes, exemplos)
  validateTemplatePayload({
    name,
    category,
    language,
    parameterFormat,
    components
  });

  try {
    const client = getMetaAxiosClient(whatsapp);
    const wabaId = whatsapp.wabaBusinessAccountId;

    if (!wabaId) {
      throw new AppError("Conexão oficial sem wabaBusinessAccountId", 400);
    }

    const body: Record<string, any> = {
      name,
      category,
      language,
      components
    };

    if (parameterFormat) {
      // Enum da Meta: NAMED | POSITIONAL (GET devolve uppercase)
      body.parameter_format = String(parameterFormat).toUpperCase();
    }
    if (allowCategoryChange !== undefined) {
      body.allow_category_change = allowCategoryChange;
    }
    if (messageSendTtlSeconds !== undefined) {
      body.message_send_ttl_seconds = messageSendTtlSeconds;
    }

    logger.info(
      `[${context}] Criando template "${name}" (${language}, ${category}) na WABA ${wabaId}`
    );

    const { data } = await client.post(`/${wabaId}/message_templates`, body);

    logger.info(
      `[${context}] Template "${name}" criado: id=${data?.id} status=${data?.status}`
    );

    return { id: data.id, status: data.status };
  } catch (error: any) {
    return throwMetaError(context, error);
  }
};

export default CreateWabaTemplate;
