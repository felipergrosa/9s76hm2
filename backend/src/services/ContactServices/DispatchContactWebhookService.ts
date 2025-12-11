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

    await axios.post(integration.urlN8N, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 15000
    });
  } catch (error) {
    logger.warn("[DispatchContactWebhookService] Falha ao enviar webhook de contato para n8n", error);
  }
};

export default DispatchContactWebhookService;
