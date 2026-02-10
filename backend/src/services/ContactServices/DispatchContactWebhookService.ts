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

// Circuit breaker: após CIRCUIT_THRESHOLD falhas consecutivas,
// para de tentar por CIRCUIT_COOLDOWN_MS para não poluir logs
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

const circuitState = new Map<number, { failures: number; openUntil: number }>();

const isCircuitOpen = (companyId: number): boolean => {
  const state = circuitState.get(companyId);
  if (!state) return false;
  if (state.openUntil > Date.now()) return true;
  // Cooldown expirou, resetar
  circuitState.delete(companyId);
  return false;
};

const recordFailure = (companyId: number): void => {
  const state = circuitState.get(companyId) || { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    logger.warn(`[DispatchContactWebhookService] Circuit breaker ABERTO para companyId=${companyId}. Webhook suspenso por 5 minutos após ${state.failures} falhas consecutivas.`);
  }
  circuitState.set(companyId, state);
};

const recordSuccess = (companyId: number): void => {
  circuitState.delete(companyId);
};

const DispatchContactWebhookService = async ({
  companyId,
  contact,
  event,
  source
}: DispatchContactWebhookParams): Promise<void> => {
  try {
    // Circuit breaker: se o circuito está aberto, não tenta
    if (isCircuitOpen(companyId)) {
      return;
    }

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

    try {
      await axios.post(integration.urlN8N, payload, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000
      });

      recordSuccess(companyId);
    } catch (error: any) {
      recordFailure(companyId);

      // Logar apenas uma vez (sem retry) para não poluir
      const code = error?.code;
      const status = error?.response?.status;

      // Log apenas em nível debug para não poluir
      logger.debug(`[DispatchContactWebhookService] Falha webhook: ${code || status || error?.message} (contactId=${contact?.id})`);
    }
  } catch (error: any) {
    logger.error("[DispatchContactWebhookService] Erro inesperado ao preparar webhook", {
      error: error?.message,
      contactId: contact?.id
    });
  }
};

export default DispatchContactWebhookService;
