import { Op } from "sequelize";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import WhatsappTemplate from "../../models/WhatsappTemplate";
import ListWabaTemplates, { WabaTemplateItem } from "./ListWabaTemplates";

interface SyncWabaTemplatesParams {
  whatsapp: Whatsapp;
  companyId: number;
}

/**
 * Sincroniza os templates da Meta com a tabela local WhatsappTemplate.
 *
 * - Upsert por (whatsappId, metaTemplateId): atualiza name/language/category/
 *   status/parameterFormat/components/rejectedReason/lastSyncedAt ou cria
 * - Remove linhas locais cujo metaTemplateId não existe mais na Meta
 *   (templates deletados pelo WhatsApp Manager ou pela API)
 *
 * Retorna a lista remota completa (todos os status).
 */
const SyncWabaTemplates = async ({
  whatsapp,
  companyId
}: SyncWabaTemplatesParams): Promise<WabaTemplateItem[]> => {
  const context = "SyncWabaTemplates";

  logger.info(
    `[${context}] Sincronizando templates: whatsappId=${whatsapp.id} companyId=${companyId}`
  );

  const remoteTemplates = await ListWabaTemplates(whatsapp);

  const localRows = await WhatsappTemplate.findAll({
    where: {
      whatsappId: whatsapp.id,
      companyId
    }
  });

  const localByMetaId = new Map<string, WhatsappTemplate>(
    localRows.map(
      (row: WhatsappTemplate): [string, WhatsappTemplate] => [
        row.metaTemplateId,
        row
      ]
    )
  );

  const remoteIds = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const remote of remoteTemplates) {
    remoteIds.add(remote.id);

    const payload = {
      companyId,
      whatsappId: whatsapp.id,
      metaTemplateId: remote.id,
      name: remote.name,
      language: remote.language,
      category: remote.category,
      status: remote.status,
      parameterFormat: remote.parameter_format || null,
      components: remote.components || [],
      rejectedReason: remote.rejected_reason || null,
      lastSyncedAt: new Date()
    };

    const existing = localByMetaId.get(remote.id);
    if (existing) {
      await existing.update(payload);
      updated += 1;
    } else {
      await WhatsappTemplate.create(payload);
      created += 1;
    }
  }

  // Remove templates locais que não existem mais na Meta
  const staleIds = localRows
    .filter((row: WhatsappTemplate) => !remoteIds.has(row.metaTemplateId))
    .map((row: WhatsappTemplate) => row.id);

  let removed = 0;
  if (staleIds.length > 0) {
    removed = await WhatsappTemplate.destroy({
      where: { id: { [Op.in]: staleIds } }
    });
  }

  logger.info(
    `[${context}] Sync concluído: ${remoteTemplates.length} remotos, ` +
      `${created} criados, ${updated} atualizados, ${removed} removidos`
  );

  return remoteTemplates;
};

export default SyncWabaTemplates;
