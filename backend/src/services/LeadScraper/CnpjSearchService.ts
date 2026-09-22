import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

// Discovery: Brasil.io socios-brasil (keyword/uf, requer BRASILIO_TOKEN)
//          ou minhareceita.org/?uf&cnae_fiscal (CNAE, sem auth, retorna registros completos)
// Enrichment: cascata OpenCNPJ → minhareceita.org → BrasilAPI

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const UA = { "User-Agent": "Whaticket/1.0" };
const RATE_LIMIT = "RATE_LIMIT";

// campo interno para filtro de CNAE secundário; removido antes de ir para results
type EnrichedLead = ScraperResult & { _cnaesSec?: string[] };

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

// comparação de texto sem acento e case-insensitive ("São Paulo" casa "SAO PAULO")
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

const toCnae7 = (v: any): string => {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(7, "0") : "";
};

// --- mappers por fonte (shape real inspecionado via curl) ---

function mapOpenCnpj(d: any, cnpj: string): EnrichedLead {
  const tel = (d.telefones || []).find((t: any) => t?.numero && !t.is_fax)
    || (d.telefones || []).find((t: any) => t?.numero);
  const principal = (d.cnaes || []).find((c: any) => c?.is_principal);
  return {
    name: d.nome_fantasia || d.razao_social || cnpj,
    razaoSocial: d.razao_social || "",
    nomeFantasia: d.nome_fantasia || "",
    phone: tel ? `(${tel.ddd}) ${tel.numero}` : "",
    email: d.email || "",
    address: [
      d.tipo_logradouro, d.logradouro, d.numero && `nº ${d.numero}`,
      d.complemento, d.bairro, d.municipio, d.uf,
    ].filter(Boolean).join(" "),
    cnpj,
    municipio: d.municipio || "",
    uf: d.uf || "",
    situacao: d.situacao_cadastral || "",
    cnaeId: toCnae7(d.cnae_principal),
    cnaeDescricao: principal?.descricao || "",
    _cnaesSec: (d.cnaes_secundarios || []).map(toCnae7).filter(Boolean),
    // OpenCNPJ não expõe código da natureza jurídica — só descrição
    naturezaJuridica: d.natureza_juridica || "",
    porte: d.porte_empresa || "",
    website: "",
  };
}

// minhareceita.org e BrasilAPI expõem o mesmo shape (mesma base Receita)
function mapMinhaReceita(d: any, cnpj: string): EnrichedLead {
  const tel = String(d.ddd_telefone_1 || d.ddd_telefone_2 || "").replace(/\D/g, "");
  const njCodigo = d.codigo_natureza_juridica ? String(d.codigo_natureza_juridica) : "";
  const njDesc = d.natureza_juridica || "";
  return {
    name: d.nome_fantasia || d.razao_social || cnpj,
    razaoSocial: d.razao_social || "",
    nomeFantasia: d.nome_fantasia || "",
    phone: tel ? `(${tel.slice(0, 2)}) ${tel.slice(2)}` : "",
    email: d.email || "",
    address: [
      d.descricao_tipo_de_logradouro, d.logradouro, d.numero && `nº ${d.numero}`,
      d.complemento, d.bairro, d.municipio, d.uf,
    ].filter(Boolean).join(" "),
    cnpj,
    municipio: d.municipio || "",
    uf: d.uf || "",
    situacao: d.descricao_situacao_cadastral || "",
    cnaeId: toCnae7(d.cnae_fiscal),
    cnaeDescricao: d.cnae_fiscal_descricao || "",
    _cnaesSec: (d.cnaes_secundarios || []).map((c: any) => toCnae7(c?.codigo)).filter(Boolean),
    naturezaJuridica: njCodigo && njDesc ? `${njCodigo} - ${njDesc}` : njDesc || njCodigo,
    porte: d.porte || d.descricao_porte || "",
    website: "",
  };
}

const ENRICH_SOURCES: Array<{
  name: string;
  url: (c: string) => string;
  map: (d: any, c: string) => EnrichedLead;
}> = [
  { name: "opencnpj", url: c => `https://api.opencnpj.org/${c}`, map: mapOpenCnpj },
  { name: "minhareceita", url: c => `https://minhareceita.org/${c}`, map: mapMinhaReceita },
  { name: "brasilapi", url: c => `https://brasilapi.com.br/api/cnpj/v1/${c}`, map: mapMinhaReceita },
];

// cascata OpenCNPJ → minhareceita → BrasilAPI; lança RATE_LIMIT se todas falharem com 429
export const enrichCnpjCascade = async (cnpj: string): Promise<ScraperResult | null> => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return null;

  let sawRateLimit = false;
  for (let i = 0; i < ENRICH_SOURCES.length; i++) {
    const src = ENRICH_SOURCES[i];
    try {
      const { data } = await axios.get(src.url(cleaned), { timeout: 10000, headers: UA });
      if (i > 0) logger.info(`[CnpjSearch] ${cleaned} enriquecido via fallback ${src.name}`);
      return src.map(data, cleaned);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) sawRateLimit = true;
      logger.warn(
        `[CnpjSearch] ${src.name} falhou p/ ${cleaned} (HTTP ${status ?? err.code ?? "?"}): ${err.message}`
      );
      await delay(200); // intervalo entre calls da cascata
    }
  }
  if (sawRateLimit) throw new Error(RATE_LIMIT);
  return null;
};

// --- pós-filtros fail-closed: filtro setado + campo ausente/não-casante = rejeitado ---

const passesFilters = (lead: EnrichedLead, f: CnpjDiscoveryFilters): boolean => {
  if (f.situacao) {
    if (!lead.situacao || !norm(lead.situacao).includes(norm(f.situacao))) return false;
  }
  if (f.cnae) {
    const target = toCnae7(f.cnae);
    const ids = [lead.cnaeId, ...(lead._cnaesSec || [])].filter(Boolean);
    if (!ids.includes(target)) return false;
  }
  if (f.municipio) {
    if (!lead.municipio || !norm(lead.municipio).includes(norm(f.municipio))) return false;
  }
  if (f.naturezaJuridica) {
    const want = f.naturezaJuridica.trim();
    const wantDigits = want.replace(/\D/g, "");
    const leadDigits = (lead.naturezaJuridica || "").match(/\d{3,4}/)?.[0] || "";
    const textMatch = norm(lead.naturezaJuridica || "").includes(norm(want));
    const codeMatch = !!wantDigits && !!leadDigits && leadDigits === wantDigits;
    if (!textMatch && !codeMatch) return false;
  }
  if (f.temTelefone && !lead.phone) return false;
  if (f.temEmail && !lead.email) return false;
  return true;
};

// --- discovery ---

async function discoverViaBrasilIo(
  filters: CnpjDiscoveryFilters,
  fetchLimit: number,
  token: string
): Promise<string[]> {
  const params: Record<string, string> = { page_size: "100" };
  if (filters.uf) params.uf = filters.uf;
  // keyword faz full-text search em razao_social; municipio reusa o search textual
  const searchTerm = filters.keyword?.trim() || filters.municipio?.trim() || "";
  if (searchTerm) params.search = searchTerm;

  const cnpjSet = new Set<string>();
  let page = 1;
  while (cnpjSet.size < fetchLimit) {
    try {
      const { data } = await axios.get(
        "https://api.brasil.io/v1/dataset/socios-brasil/empresas/data/",
        {
          params: { ...params, page },
          headers: { Authorization: `Token ${token}`, "User-Agent": "Whaticket/1.0" },
          timeout: 20000,
        }
      );
      const rows: any[] = data.results || [];
      for (const row of rows) {
        const c = String(row.cnpj || "").replace(/\D/g, "");
        if (c.length === 14) cnpjSet.add(c);
      }
      if (!data.next || rows.length === 0) break;
      page++;
      await delay(200);
    } catch (err: any) {
      logger.warn(
        `[CnpjSearch] Brasil.io page ${page} HTTP ${err.response?.status ?? "?"}: ${err.message}`
      );
      break;
    }
  }
  return [...cnpjSet];
}

// sem BRASILIO_TOKEN: busca por CNAE (uf opcional) — retorna registros já completos
async function discoverViaMinhaReceita(
  filters: CnpjDiscoveryFilters,
  fetchLimit: number
): Promise<EnrichedLead[]> {
  const leads: EnrichedLead[] = [];
  const seen = new Set<string>();
  let cursor = "";
  while (leads.length < fetchLimit) {
    const params: Record<string, string> = { limit: "100" };
    if (filters.uf) params.uf = filters.uf.toUpperCase();
    if (filters.cnae) params.cnae_fiscal = filters.cnae.replace(/\D/g, "");
    if (cursor) params.cursor = cursor;
    try {
      const { data } = await axios.get("https://minhareceita.org/", {
        params,
        headers: UA,
        timeout: 20000,
      });
      const rows: any[] = data.data || [];
      for (const row of rows) {
        const c = String(row.cnpj || "").replace(/\D/g, "");
        if (c.length === 14 && !seen.has(c)) {
          seen.add(c);
          leads.push(mapMinhaReceita(row, c));
        }
      }
      cursor = data.cursor ? String(data.cursor) : "";
      if (!cursor || rows.length === 0) break;
      await delay(250);
    } catch (err: any) {
      logger.warn(
        `[CnpjSearch] minhareceita discovery HTTP ${err.response?.status ?? "?"}: ${err.message}`
      );
      break;
    }
  }
  return leads;
}

export const searchCnpjsByFilters = async (
  filters: CnpjDiscoveryFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const token = process.env.BRASILIO_TOKEN;
  const maxResults = Math.min(filters.maxResults || 100, 500);
  const fetchLimit = Math.min(maxResults * 3, 900);

  if (!token) {
    if (filters.keyword?.trim()) {
      throw new Error(
        "Busca por palavra-chave requer BRASILIO_TOKEN (grátis em brasil.io/auth/tokens/). Sem o token, informe filters.cnae."
      );
    }
    if (!filters.cnae) {
      throw new Error(
        "Configure BRASILIO_TOKEN no .env ou informe filters.cnae para discovery via minhareceita.org."
      );
    }
  }

  const results: ScraperResult[] = [];

  if (!token) {
    // minhareceita: registros já vêm completos — só pós-filtrar
    const leads = await discoverViaMinhaReceita(filters, fetchLimit);
    for (const lead of leads) {
      if (results.length >= maxResults) break;
      if (!passesFilters(lead, filters)) continue;
      delete lead._cnaesSec;
      results.push(lead);
      await onProgress?.(results.length, maxResults);
    }
    logger.info(`[CnpjSearch] minhareceita: ${leads.length} fetched → ${results.length} passed filters`);
    return results;
  }

  // Brasil.io: discovery retorna só CNPJs — enriquecer um a um via cascata
  const cnpjList = await discoverViaBrasilIo(filters, fetchLimit, token);
  if (!cnpjList.length) return [];

  let processed = 0;
  let consecutiveRateLimits = 0;

  for (const cnpj of cnpjList) {
    if (results.length >= maxResults) break;

    let lead: EnrichedLead | null = null;
    try {
      lead = (await enrichCnpjCascade(cnpj)) as EnrichedLead | null;
      consecutiveRateLimits = 0;
    } catch (err: any) {
      if (err.message === RATE_LIMIT) {
        consecutiveRateLimits++;
        logger.warn(`[CnpjSearch] rate limit consecutivo ${consecutiveRateLimits}/3`);
        if (consecutiveRateLimits >= 3) {
          logger.warn("[CnpjSearch] 3 rate limits seguidos — retornando resultados parciais");
          break;
        }
      } else {
        logger.warn(`[CnpjSearch] enrich ${cnpj}: ${err.message}`);
      }
    }

    processed++;
    if (lead && passesFilters(lead, filters)) {
      delete lead._cnaesSec;
      results.push(lead);
      await onProgress?.(results.length, maxResults);
    }

    await delay(250); // entre TODOS os CNPJs processados — rate-limit safety
  }

  logger.info(`[CnpjSearch] ${processed} enriched → ${results.length} passed filters`);
  return results;
};
