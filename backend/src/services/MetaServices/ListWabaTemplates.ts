import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getMetaAxiosClient, throwMetaError } from "./metaApiClient";

/**
 * Item retornado pela listagem de templates da Meta
 * GET /{wabaId}/message_templates
 */
export interface WabaTemplateItem {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  sub_category?: string;
  parameter_format?: string;
  components: any[];
  quality_score?: any;
  rejected_reason?: string;
}

const TEMPLATE_FIELDS =
  "id,name,language,status,category,sub_category,parameter_format,components," +
  "quality_score,rejected_reason";

// Guarda contra loop infinito de paginação
const MAX_PAGES = 20;

/**
 * Lista TODOS os templates da WABA na Meta (qualquer status),
 * seguindo paging.next até o fim da paginação.
 * Opcionalmente aplica filtro de status (ex.: "APPROVED").
 */
const ListWabaTemplates = async (
  whatsapp: Whatsapp,
  statusFilter?: string
): Promise<WabaTemplateItem[]> => {
  const context = "ListWabaTemplates";

  try {
    const client = getMetaAxiosClient(whatsapp);
    const wabaId = whatsapp.wabaBusinessAccountId;

    if (!wabaId) {
      throw new AppError("Conexão oficial sem wabaBusinessAccountId", 400);
    }

    logger.info(
      `[${context}] Listando templates da WABA ${wabaId}` +
        (statusFilter ? ` (status=${statusFilter})` : "")
    );

    const templates: WabaTemplateItem[] = [];
    let nextUrl: string | null = `/${wabaId}/message_templates`;
    let params: Record<string, any> | undefined = {
      fields: TEMPLATE_FIELDS,
      limit: 100
    };
    if (statusFilter) {
      params.status = statusFilter;
    }

    let pages = 0;

    // paging.next já é URL absoluta — axios ignora o baseURL nesse caso.
    // params só são enviados na primeira requisição; as próximas já
    // trazem o cursor embutido na URL.
    while (nextUrl && pages < MAX_PAGES) {
      const { data } = await client.get(nextUrl, { params });

      const items: WabaTemplateItem[] = data?.data || [];
      templates.push(...items);

      nextUrl = data?.paging?.next || null;
      params = undefined;
      pages += 1;
    }

    if (pages >= MAX_PAGES && nextUrl) {
      logger.warn(
        `[${context}] Paginação interrompida no limite de ${MAX_PAGES} páginas ` +
          `(${templates.length} templates carregados)`
      );
    }

    logger.info(
      `[${context}] ${templates.length} template(s) retornados em ${pages} página(s)`
    );

    return templates;
  } catch (error: any) {
    return throwMetaError(context, error);
  }
};

export default ListWabaTemplates;
