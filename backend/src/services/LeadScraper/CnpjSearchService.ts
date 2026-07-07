import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

// Brasil.io free tier: socios-brasil dataset (cnpj + razao_social + uf)
// cnpj.ws public API: full enrichment per CNPJ (CNAE, phone, email, address)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface CnpjDiscoveryFilters {
  keyword?: string;        // text search in razao_social (brasil.io)
  cnae?: string;           // post-filter: 7-digit CNAE code
  naturezaJuridica?: string; // post-filter: e.g. "206-2"
  situacao?: string;       // post-filter: ATIVA | SUSPENSA | INAPTA | BAIXADA
  uf?: string;
  municipio?: string;      // post-filter: city name
  temTelefone?: boolean;
  temEmail?: boolean;
  maxResults?: number;
}

async function enrichViaCnpjWs(cnpj: string): Promise<ScraperResult | null> {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return null;
  try {
    const { data } = await axios.get(`https://publica.cnpj.ws/cnpj/${cleaned}`, {
      timeout: 10000,
      headers: { "User-Agent": "Whaticket/1.0" },
    });

    const est = data.estabelecimento || {};
    const phone = est.ddd1 && est.telefone1
      ? `(${est.ddd1}) ${est.telefone1}`
      : "";
    // id = "8550301" (7 digits), subclasse = "8550-3/01" (formatted) — use id for filtering
    const cnaeId: string = est.atividade_principal?.id ?? "";
    const cnaeDesc: string = est.atividade_principal?.descricao ?? "";
    const cnaeSubclasse: string = est.atividade_principal?.subclasse ?? "";
    const njId: string = data.natureza_juridica?.id ?? "";
    const njDesc: string = data.natureza_juridica?.descricao ?? "";

    return {
      name: est.nome_fantasia || data.razao_social || cnpj,
      razaoSocial: data.razao_social || "",
      nomeFantasia: est.nome_fantasia || "",
      phone,
      email: est.email || "",
      address: [
        est.tipo_logradouro, est.logradouro, est.numero && `nº ${est.numero}`,
        est.bairro, est.cidade?.nome, est.estado?.sigla,
      ].filter(Boolean).join(" "),
      cnpj,
      municipio: est.cidade?.nome || "",
      uf: est.estado?.sigla || "",
      situacao: est.situacao_cadastral || "",
      cnaeId,                     // raw 7-digit id for filtering
      cnaeDescricao: cnaeSubclasse ? `${cnaeSubclasse} - ${cnaeDesc}` : cnaeDesc,
      naturezaJuridica: njId ? `${njId} - ${njDesc}` : njDesc,
      porte: data.porte?.descricao || "",
      website: "",
    };
  } catch (err: any) {
    // ponytail: 429 means rate-limited; other errors = invalid CNPJ or temporary issue
    if (err.response?.status === 429) throw new Error("RATE_LIMIT");
    return null;
  }
}

export const searchCnpjsByFilters = async (
  filters: CnpjDiscoveryFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const token = process.env.BRASILIO_TOKEN;
  if (!token) throw new Error(
    "Configure BRASILIO_TOKEN no .env. Token gratuito em brasil.io/auth/tokens/"
  );

  const maxResults = Math.min(filters.maxResults || 100, 500);

  // Step 1: get CNPJs from socios-brasil (free, filtered by uf + text search)
  const brasilioParams: Record<string, string> = { page_size: "100" };
  if (filters.uf) brasilioParams.uf = filters.uf;
  // keyword searches in razao_social (brasil.io full-text search)
  const searchTerm = filters.keyword?.trim() || filters.municipio?.trim() || "";
  if (searchTerm) brasilioParams.search = searchTerm;

  const cnpjList: string[] = [];
  let page = 1;
  const fetchLimit = Math.min(maxResults * 3, 300); // fetch 3× more to allow for post-filter losses

  while (cnpjList.length < fetchLimit) {
    try {
      const { data } = await axios.get(
        "https://api.brasil.io/v1/dataset/socios-brasil/empresas/data/",
        {
          params: { ...brasilioParams, page },
          headers: {
            Authorization: `Token ${token}`,
            "User-Agent": "Whaticket/1.0",
          },
          timeout: 20000,
        }
      );

      const rows: any[] = data.results || [];
      for (const row of rows) {
        if (row.cnpj) cnpjList.push(String(row.cnpj).replace(/\D/g, ""));
      }

      if (!data.next || rows.length === 0) break;
      page++;
      await delay(200);
    } catch (err: any) {
      const status = err.response?.status;
      logger.warn(`[CnpjSearch] Brasil.io page ${page} HTTP ${status ?? "?"}: ${err.message}`);
      // 404 = endpoint/dataset gone; 5xx = transient — abort discovery gracefully
      break;
    }
  }

  if (!cnpjList.length) return [];

  // Step 2: enrich each CNPJ via cnpj.ws and post-filter
  const results: ScraperResult[] = [];
  let enriched = 0;

  for (const cnpj of cnpjList) {
    if (results.length >= maxResults) break;

    let lead: ScraperResult | null = null;
    try {
      lead = await enrichViaCnpjWs(cnpj);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT") {
        logger.warn("[CnpjSearch] cnpj.ws rate limit hit, waiting 30s");
        await delay(30000);
        lead = await enrichViaCnpjWs(cnpj).catch(() => null);
      }
    }

    enriched++;
    if (!lead) continue;

    // Post-filters (cnpj.ws returns text labels like "Ativa", "Baixada")
    if (filters.situacao && lead.situacao) {
      if (!lead.situacao.toUpperCase().includes(filters.situacao.toUpperCase())) continue;
    }
    if (filters.cnae && lead.cnaeId) {
      if (lead.cnaeId !== filters.cnae.replace(/\D/g, "")) continue;
    }
    if (filters.municipio && lead.municipio) {
      if (!lead.municipio.toUpperCase().includes(filters.municipio.toUpperCase())) continue;
    }
    if (filters.naturezaJuridica && lead.naturezaJuridica) {
      if (!lead.naturezaJuridica.startsWith(filters.naturezaJuridica)) continue;
    }
    if (filters.temTelefone && !lead.phone) continue;
    if (filters.temEmail && !lead.email) continue;

    results.push(lead);
    await onProgress?.(results.length, maxResults);

    // ponytail: 600ms between calls to stay within cnpj.ws rate limit
    await delay(600);
  }

  logger.info(`[CnpjSearch] enriched ${enriched} → ${results.length} passed filters`);
  return results;
};
