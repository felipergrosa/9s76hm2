import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import { decryptString } from "../../utils/crypto";
import logger from "../../utils/logger";

export type Provider = "openai" | "gemini" | "deepseek" | "grok";

export interface ResolveParams {
  companyId: number;
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  preferProvider?: Provider | null; // dica do front, não obrigatório
  // strictProvider: quando preferProvider está definido, NÃO cai nos
  // fallbacks openai→gemini — usado pelo teste de conexão, que precisa
  // medir exatamente o provider pedido (antes o teste de "openai" podia
  // executar Gemini e reportar o erro dele como erro do OpenAI).
  strictProvider?: boolean;
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
    try {
      cfg.apiKey = decryptString(key);
    } catch (err) {
      // Sem a env de decrypt a apiKey fica "ENC::..." mascarada e a
      // integração falharia mais adiante de forma opaca — logar explícito.
      logger.error(`[ResolveAIIntegration] Falha ao descriptografar apiKey (type=${type}) — configure OPENAI_ENCRYPTION_KEY/DATA_KEY`, err);
    }
  }
  return cfg;
};

const fetchIntegrationById = async (id: number | string | null | undefined, companyId: number) => {
  if (!id && id !== 0) return null;
  // findOne com companyId — findByPk puro permitiria resolver integração
  // de outra empresa (IDOR)
  const integ = await QueueIntegrations.findOne({
    where: { id: id as any, companyId }
  });
  if (!integ) return null;
  const cfg = maybeDecryptKey(integ.type, parseJson(integ.jsonContent));
  return { provider: integ.type as Provider, config: cfg } as ResolvedIntegration;
};

const ResolveAIIntegrationService = async ({ companyId, queueId, whatsappId, preferProvider, strictProvider }: ResolveParams): Promise<ResolvedIntegration | null> => {
  // 1) Se vier queueId, usar integrationId da fila
  try {
    if (queueId) {
      const q = await Queue.findOne({
        where: { id: queueId as any, companyId }
      });
      if (q?.integrationId) {
        const r = await fetchIntegrationById(q.integrationId, companyId);
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
      const w = await Whatsapp.findOne({
        where: { id: whatsappId as any, companyId }
      });
      // Alguns ambientes usam whatsapp.integrationId
      const anyW: any = w as any;
      if (anyW?.integrationId) {
        const r = await fetchIntegrationById(anyW.integrationId, companyId);
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

  // 4) Fallback: tenta openai, depois gemini no escopo da empresa.
  // Em modo estrito (teste de conexão) isso é desligado — senão o teste
  // de um provider acaba executando outro e o erro sai rotulado errado.
  if (strictProvider && preferProvider) {
    return null;
  }
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
