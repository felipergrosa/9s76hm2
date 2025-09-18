import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import { decryptString } from "../../utils/crypto";

export type Provider = "openai" | "gemini";

export interface ResolveParams {
  companyId: number;
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  preferProvider?: Provider | null; // dica do front, não obrigatório
}

export interface ResolvedIntegration {
  provider: Provider;
  config: any; // jsonContent parseado (model, apiKey, temperature, etc.)
}

const parseJson = (val: any): any => {
  if (!val) return {};
  if (typeof val === "object") return val;
  try { return JSON.parse(String(val)); } catch { return {}; }
};

const maybeDecryptKey = (type: string, cfg: any) => {
  if (!cfg) return cfg;
  const key = cfg.apiKey;
  if (typeof key === "string" && key.startsWith("ENC::")) {
    try { cfg.apiKey = decryptString(key); } catch { /* keep masked */ }
  }
  return cfg;
};

const fetchIntegrationById = async (id?: number | string | null) => {
  if (!id && id !== 0) return null;
  const integ = await QueueIntegrations.findByPk(id as any);
  if (!integ) return null;
  const cfg = maybeDecryptKey(integ.type, parseJson(integ.jsonContent));
  return { provider: integ.type as Provider, config: cfg } as ResolvedIntegration;
};

const ResolveAIIntegrationService = async ({ companyId, queueId, whatsappId, preferProvider }: ResolveParams): Promise<ResolvedIntegration | null> => {
  // 1) Se vier queueId, usar integrationId da fila
  try {
    if (queueId) {
      const q = await Queue.findByPk(queueId as any);
      if (q?.integrationId) {
        const r = await fetchIntegrationById(q.integrationId);
        if (r?.config?.apiKey) {
          try { console.log("[IA][resolve] via queue", { queueId, provider: r.provider }); } catch {}
          return r;
        }
      }
    }
  } catch {}

  // 2) Se vier whatsappId e a conexão tiver integrationId, usar
  try {
    if (whatsappId) {
      const w = await Whatsapp.findByPk(whatsappId as any);
      // Alguns ambientes usam whatsapp.integrationId
      const anyW: any = w as any;
      if (anyW?.integrationId) {
        const r = await fetchIntegrationById(anyW.integrationId);
        if (r?.config?.apiKey) {
          try { console.log("[IA][resolve] via whatsapp", { whatsappId, provider: r.provider }); } catch {}
          return r;
        }
      }
    }
  } catch {}

  // 3) Preferência de provedor: tenta pelo tipo na empresa
  try {
    if (preferProvider) {
      const integ = await GetIntegrationByTypeService({ companyId, type: preferProvider });
      if (integ?.jsonContent?.apiKey) {
        try { console.log("[IA][resolve] via company-prefer", { companyId, provider: preferProvider }); } catch {}
        return { provider: preferProvider, config: integ.jsonContent };
      }
    }
  } catch {}

  // 4) Fallback: tenta openai, depois gemini no escopo da empresa
  try {
    const open = await GetIntegrationByTypeService({ companyId, type: "openai" });
    if (open?.jsonContent?.apiKey) {
      try { console.log("[IA][resolve] via company-openai", { companyId }); } catch {}
      return { provider: "openai", config: open.jsonContent };
    }
  } catch {}
  try {
    const gem = await GetIntegrationByTypeService({ companyId, type: "gemini" });
    if (gem?.jsonContent?.apiKey) {
      try { console.log("[IA][resolve] via company-gemini", { companyId }); } catch {}
      return { provider: "gemini", config: gem.jsonContent };
    }
  } catch {}

  return null;
};

export default ResolveAIIntegrationService;
