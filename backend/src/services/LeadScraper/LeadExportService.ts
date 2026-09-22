import axios from "axios";
import Contact from "../../models/Contact";
import LeadScraperJob from "../../models/LeadScraperJob";
import ContactCustomField from "../../models/ContactCustomField";
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import logger from "../../utils/logger";
import { leadExportQueue } from "../../queues";

interface EnqueueLeadExportParams {
  companyId: number;
  contactIds: number[];
  jobId?: number;
  source?: string;
}

interface LeadExportJobData {
  companyId: number;
  contactIds: number[];
  jobId?: number;
  source?: string;
}

// Enfileira o envio em lote dos contatos importados para o ERP via n8n.
// Chamado logo após ImportLeadsService — fire-and-forget para não bloquear
// a resposta da importação.
export const enqueueLeadExport = async ({
  companyId,
  contactIds,
  jobId,
  source = "lead_scraper"
}: EnqueueLeadExportParams): Promise<void> => {
  if (!contactIds || contactIds.length === 0) return;

  try {
    await leadExportQueue.add(
      "ExportBatch",
      { companyId, contactIds, jobId, source } as LeadExportJobData,
      {
        // jobId dedup: reimportar o mesmo job não duplica o envio enquanto
        // houver um envio pendente/em andamento para ele
        jobId: jobId ? `lead-export-${companyId}-${jobId}` : undefined,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    if (jobId) {
      await LeadScraperJob.update(
        { erpSyncStatus: "pending", erpSyncError: null },
        { where: { id: jobId } }
      );
    }
  } catch (err: any) {
    // Fila indisponível (Redis down): executa inline como fallback
    logger.warn(`[LeadExport] Fila indisponível, executando inline: ${err?.message}`);
    await processLeadExport({ companyId, contactIds, jobId, source });
  }
};

// Monta o payload batch e POSTa para a urlN8N configurada na empresa.
// O n8n normaliza e faz o upsert no SQL Server/ERP (WhaticketContactMap
// controla idempotência por hash — reenvios são seguros).
export const processLeadExport = async ({
  companyId,
  contactIds,
  jobId,
  source = "lead_scraper"
}: LeadExportJobData): Promise<void> => {
  try {
    let integration = await GetIntegrationByTypeService({ companyId, type: "webhook" });
    if (!integration || !integration.urlN8N) {
      integration = await GetIntegrationByTypeService({ companyId, type: "n8n" });
    }

    if (!integration || !integration.urlN8N) {
      logger.info(`[LeadExport] companyId=${companyId} sem urlN8N configurada; export ignorado`);
      if (jobId) {
        await LeadScraperJob.update(
          { erpSyncStatus: "failed", erpSyncError: "urlN8N não configurada" },
          { where: { id: jobId } }
        );
      }
      return;
    }

    const contacts = await Contact.findAll({
      where: { id: contactIds, companyId },
      include: [{ model: ContactCustomField, as: "extraInfo", required: false }]
    });

    if (contacts.length === 0) {
      logger.warn(`[LeadExport] Nenhum contato encontrado p/ companyId=${companyId} ids=${contactIds.length}`);
      return;
    }

    const payload = {
      event: "leads.imported",
      companyId,
      jobId: jobId || null,
      source,
      timestamp: new Date().toISOString(),
      total: contacts.length,
      leads: contacts.map(c => {
        const json: any = c.toJSON ? c.toJSON() : c;
        // Achata custom fields em objeto chave→valor p/ facilitar o mapeamento no n8n
        const custom: Record<string, string> = {};
        (json.extraInfo || []).forEach((f: any) => {
          if (f?.name) custom[f.name] = f.value;
        });
        delete json.extraInfo;
        return { ...json, customFields: custom };
      })
    };

    await axios.post(integration.urlN8N, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000
    });

    if (jobId) {
      await LeadScraperJob.update(
        { erpSyncStatus: "sent", erpSyncedAt: new Date(), erpSyncError: null },
        { where: { id: jobId } }
      );
    }
    logger.info(`[LeadExport] ${contacts.length} lead(s) enviados p/ n8n (companyId=${companyId}, jobId=${jobId})`);
  } catch (err: any) {
    logger.error(`[LeadExport] Falha no envio (companyId=${companyId}, jobId=${jobId}): ${err?.message}`);
    if (jobId) {
      await LeadScraperJob.update(
        { erpSyncStatus: "failed", erpSyncError: String(err?.message || err).slice(0, 500) },
        { where: { id: jobId } }
      ).catch(() => {});
    }
    // Re-lança para o Bull registrar a tentativa e aplicar retry/backoff
    throw err;
  }
};
