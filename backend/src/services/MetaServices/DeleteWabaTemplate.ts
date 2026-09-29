import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getMetaAxiosClient, throwMetaError } from "./metaApiClient";

interface DeleteWabaTemplateParams {
  whatsapp: Whatsapp;
  /** Nome do template (sozinho remove TODOS os idiomas) */
  name?: string;
  /** ID do template na Meta — remove só o idioma daquele ID (exige name junto) */
  templateId?: string;
  /** Lista de IDs para remoção em massa (até 100, não combina com name/templateId) */
  templateIds?: string[];
}

interface DeleteWabaTemplateResult {
  success: boolean;
}

const MAX_BULK_DELETE = 100;

/**
 * Remove template(s) na Meta:
 * DELETE /{wabaId}/message_templates
 *
 * Três modos suportados (mutuamente exclusivos):
 * - ?name=X                    → remove o nome em TODOS os idiomas
 * - ?hsm_id=ID&name=X          → remove apenas o idioma do template ID
 * - ?hsm_ids=[id1,id2,...]     → remoção em massa (até 100)
 *
 * Requer scope whatsapp_business_management (erro Meta code 200).
 * Templates com status DISABLED não podem ser deletados.
 */
const DeleteWabaTemplate = async ({
  whatsapp,
  name,
  templateId,
  templateIds
}: DeleteWabaTemplateParams): Promise<DeleteWabaTemplateResult> => {
  const context = "DeleteWabaTemplate";

  const hasBulkIds = Array.isArray(templateIds) && templateIds.length > 0;

  let params: Record<string, any>;
  let logDescription: string;

  if (hasBulkIds) {
    if (name || templateId) {
      throw new AppError(
        "templateIds não pode ser combinado com name/templateId",
        400
      );
    }
    if (templateIds!.length > MAX_BULK_DELETE) {
      throw new AppError(
        `Remoção em massa aceita no máximo ${MAX_BULK_DELETE} templates`,
        400
      );
    }
    params = { hsm_ids: JSON.stringify(templateIds) };
    logDescription = `${templateIds!.length} templates em massa`;
  } else if (templateId) {
    if (!name) {
      throw new AppError(
        "name é obrigatório ao deletar por templateId (hsm_id)",
        400
      );
    }
    params = { hsm_id: templateId, name };
    logDescription = `template "${name}" (id=${templateId})`;
  } else if (name) {
    params = { name };
    logDescription = `template "${name}" (todos os idiomas)`;
  } else {
    throw new AppError(
      "Informe name (todos os idiomas), templateId+name (um idioma) " +
        "ou templateIds (remoção em massa)",
      400
    );
  }

  try {
    const client = getMetaAxiosClient(whatsapp);
    const wabaId = whatsapp.wabaBusinessAccountId;

    if (!wabaId) {
      throw new AppError("Conexão oficial sem wabaBusinessAccountId", 400);
    }

    logger.info(`[${context}] Removendo ${logDescription} da WABA ${wabaId}`);

    const { data } = await client.delete(`/${wabaId}/message_templates`, {
      params
    });

    logger.info(`[${context}] ${logDescription} removido(s) com sucesso`);

    return { success: data?.success === true };
  } catch (error: any) {
    return throwMetaError(context, error);
  }
};

export default DeleteWabaTemplate;
