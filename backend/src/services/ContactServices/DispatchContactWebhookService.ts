import axios from "axios";

import logger from "../../utils/logger";
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import Contact from "../../models/Contact";

interface DispatchContactWebhookParams {
  companyId: number;
  contact: Contact;
  event: "create" | "update";
  source?: string;
}

const DispatchContactWebhookService = async ({
  companyId,
  contact,
  event,
  source
}: DispatchContactWebhookParams): Promise<void> => {
  try {
    // 1) Tenta integração do tipo "webhook" (mais genérica)
    let integration = await GetIntegrationByTypeService({
      companyId,
      type: "webhook"
    });

    // 2) Fallback: se não houver, tenta integração do tipo "n8n"
    if (!integration || !integration.urlN8N) {
      integration = await GetIntegrationByTypeService({
        companyId,
        type: "n8n"
      });
    }

    if (!integration || !integration.urlN8N) {
      return;
    }

    const payload = {
      event: event === "create" ? "contact.created" : "contact.updated",
      companyId,
      source: source || "contacts",
      timestamp: new Date().toISOString(),
      contact: contact?.toJSON ? contact.toJSON() : contact
    };

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await axios.post(integration.urlN8N, payload, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 30000 // Aumentado de 15s para 30s
        });

        // Sucesso - sair do loop
        if (attempt > 1) {
          logger.info(`[DispatchContactWebhookService] Webhook enviado com sucesso na tentativa ${attempt}/${maxRetries}`);
        }
        return;

      } catch (error: any) {
        lastError = error;

        // Se for última tentativa ou erro não-retriable, não tentar novamente
        const isRetriable = !error?.response || error.response.status >= 500 || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';

        if (attempt < maxRetries && isRetriable) {
          const backoffMs = attempt * 1000; // 1s, 2s, 3s
          logger.warn(`[DispatchContactWebhookService] Tentativa ${attempt}/${maxRetries} falhou, aguardando ${backoffMs}ms antes de retry`, {
            status: error?.response?.status,
            code: error?.code,
            message: error?.message
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          break; // Não retriable ou última tentativa
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    const status = lastError?.response?.status;
    const data = lastError?.response?.data;
    const code = lastError?.code;
    const message = lastError?.message;

    logger.warn("[DispatchContactWebhookService] Falha ao enviar webhook de contato para n8n (todas tentativas falharam)", {
      url: integration.urlN8N,
      contactId: contact.id,
      contactName: contact.name,
      event,
      status,
      data,
      code,
      message,
      attempts: maxRetries
    });
  } catch (error: any) {
    logger.error("[DispatchContactWebhookService] Erro inesperado ao preparar/enviar webhook", {
      error: error?.message,
      contactId: contact?.id
    });
  }
};

export default DispatchContactWebhookService;
