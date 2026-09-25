import axios from "axios";
import { ScraperResult, MultiValue } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";
import { toArray, resolveMaxResults } from "./ScraperFilterUtils";

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
  cnae?: MultiValue;           // post-filter: 7-digit CNAE code
  naturezaJuridica?: MultiValue; // post-filter: e.g. "206-2"
  situacao?: MultiValue;       // post-filter: ATIVA | SUSPENSA | INAPTA | BAIXADA
  uf?: MultiValue;
  municipio?: MultiValue;      // post-filter: city name
  temTelefone?: boolean;
  temEmail?: boolean;
  maxResults?: number;
  // discovery CNAE-only: força minhareceita mesmo com BRASILIO_TOKEN — a API
  // do Brasil.io não filtra por CNAE no request, varreria a UF inteira
  forceMinhaReceita?: boolean;
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
    capitalSocial: d.capital_social != null ? String(d.capital_social) : "",
    dataAbertura: d.data_inicio_atividade || "",
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
    capitalSocial: d.capital_social != null ? String(d.capital_social) : "",
    dataAbertura: d.data_inicio_atividade || "",
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
  const situacoes = toArray(f.situacao);
  if (situacoes.length) {
    if (!lead.situacao || !situacoes.some(v => norm(lead.situacao).includes(norm(v)))) return false;
  }
  const cnaes = toArray(f.cnae);
  if (cnaes.length) {
    const targets = cnaes.map(toCnae7);
    const ids = [lead.cnaeId, ...(lead._cnaesSec || [])].filter(Boolean);
    if (!targets.some(target => ids.includes(target))) return false;
  }
  const municipios = toArray(f.municipio);
  if (municipios.length) {
    if (!lead.municipio || !municipios.some(v => norm(lead.municipio).includes(norm(v)))) return false;
  }
  const naturezas = toArray(f.naturezaJuridica);
  if (naturezas.length) {
    const leadDigits = (lead.naturezaJuridica || "").match(/\d{3,4}/)?.[0] || "";
    const matches = naturezas.some(want => {
      const wantDigits = want.replace(/\D/g, "");
      const textMatch = norm(lead.naturezaJuridica || "").includes(norm(want));
      const codeMatch = !!wantDigits && !!leadDigits && leadDigits === wantDigits;
      return textMatch || codeMatch;
    });
    if (!matches) return false;
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
  // API do Brasil.io só aceita 1 uf por request — itera por uf quando multi-select
  const ufs = toArray(filters.uf);
  const ufList: Array<string | undefined> = ufs.length ? ufs : [undefined];

  // keyword faz full-text search em razao_social; municipio (primeiro valor) reusa o search textual
  const searchTerm = filters.keyword?.trim() || toArray(filters.municipio)[0] || "";

  const cnpjSet = new Set<string>();

  for (const uf of ufList) {
    if (cnpjSet.size >= fetchLimit) break;
    const params: Record<string, string> = { page_size: "100" };
    if (uf) params.uf = uf;
    if (searchTerm) params.search = searchTerm;

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
          `[CnpjSearch] Brasil.io page ${page} (uf=${uf ?? "-"}) HTTP ${err.response?.status ?? "?"}: ${err.message}`
        );
        break;
      }
    }
  }
  return [...cnpjSet];
}

// sem BRASILIO_TOKEN: busca por CNAE (uf opcional) — retorna registros já completos
// ponytail: guarda simples pra não deixar um usuário escolher 10 ufs x 10 cnaes e martelar a API
const MAX_MINHARECEITA_COMBOS = 12;

async function discoverViaMinhaReceita(
  filters: CnpjDiscoveryFilters,
  fetchLimit: number
): Promise<EnrichedLead[]> {
  const ufs = toArray(filters.uf);
  const cnaes = toArray(filters.cnae);
  const ufList: Array<string | undefined> = ufs.length ? ufs : [undefined];
  const cnaeList: Array<string | undefined> = cnaes.length ? cnaes : [undefined];

  const combos: Array<{ uf?: string; cnae?: string }> = [];
  for (const uf of ufList) {
    for (const cnae of cnaeList) {
      combos.push({ uf, cnae });
      if (combos.length >= MAX_MINHARECEITA_COMBOS) break;
    }
    if (combos.length >= MAX_MINHARECEITA_COMBOS) break;
  }

  const leads: EnrichedLead[] = [];
  const seen = new Set<string>();

  for (const combo of combos) {
    if (leads.length >= fetchLimit) break;
    let cursor = "";
    while (leads.length < fetchLimit) {
      const params: Record<string, string> = { limit: "100" };
      if (combo.uf) params.uf = combo.uf.toUpperCase();
      if (combo.cnae) params.cnae_fiscal = combo.cnae.replace(/\D/g, "");
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
          `[CnpjSearch] minhareceita discovery (uf=${combo.uf ?? "-"}, cnae=${combo.cnae ?? "-"}) HTTP ${err.response?.status ?? "?"}: ${err.message}`
        );
        break;
      }
    }
  }
  return leads;
}

export const searchCnpjsByFilters = async (
  filters: CnpjDiscoveryFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const token = process.env.BRASILIO_TOKEN;
  const maxResults = resolveMaxResults(filters.maxResults, 1000);
  const fetchLimit = Math.min(maxResults * 3, 3000);

  if (!token || filters.forceMinhaReceita) {
    if (filters.keyword?.trim() && !filters.forceMinhaReceita) {
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

  if (!token || filters.forceMinhaReceita) {
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
