import OpenAI from "openai";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import FindCompanySettingOneService from "../CompaniesSettings/FindCompanySettingOneService";
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";

export interface EmbedOptions {
  model?: string; // default: text-embedding-3-small (1536)
}

export const embedTexts = async (companyId: number, texts: string[], opts: EmbedOptions = {}): Promise<number[][]> => {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  // Sempre preferimos OpenAI para embeddings nesta primeira versão
  const resolved = await ResolveAIIntegrationService({ companyId, preferProvider: "openai" as any });

  const apiKey = resolved?.config?.apiKey;
  // Modelo de embedding definido na integração 'knowledge' (prioritário) ou CompaniesSettings (legado)
  let configuredModel = "text-embedding-3-small"; // baixo custo (1536)
  try {
    const knowledge = await GetIntegrationByTypeService({ companyId, type: 'knowledge' });
    const j = (knowledge?.jsonContent || {}) as any;
    if (j?.ragEmbeddingModel && typeof j.ragEmbeddingModel === 'string') configuredModel = j.ragEmbeddingModel;
  } catch {}
  try {
    if (!configuredModel) {
      const setting = await FindCompanySettingOneService({ companyId, column: "ragEmbeddingModel" });
      const val = (setting as any)?.[0]?.["ragEmbeddingModel"] as string | undefined;
      if (val && typeof val === "string") configuredModel = val;
    }
  } catch {}
  const requested = opts.model || configuredModel;
  // Garantir compatibilidade com coluna vector(1536)
  const model = /small/i.test(requested) ? requested : "text-embedding-3-small";

  if (!apiKey) throw new Error("Nenhuma integração OpenAI válida encontrada. Configure em Integrações → Queue Integration.");

  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model,
    input: texts,
  });

  const vectors = (response.data || []).map(d => (d as any)?.embedding as number[]);
  return vectors;
};
