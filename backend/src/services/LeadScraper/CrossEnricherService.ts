import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import { enrichCnpj } from "./CnpjEnricherService";
import logger from "../../utils/logger";

/**
 * Enriquecimento cruzado: leads encontrados em qualquer fonte (Maps, CAU,
 * IG, planilha) sem CNPJ tentam ser localizados na base da Receita via
 * busca textual por nome no Brasil.io, e então enriquecidos pela cascata
 * OpenCNPJ → minhareceita → BrasilAPI (enrichCnpj).
 *
 * O match é conservador para evitar falsos positivos:
 * - exige sobreposição alta de tokens do nome (>= 80%)
 * - quando o lead tem UF, exige UF igual
 */

const UA = { "User-Agent": "Whaticket/1.0" };
const BRASILIO_URL = "https://api.brasil.io/v1/dataset/socios-brasil/empresas/data/";

// Sufixos societários e ruído comum em nomes de fachada vs razão social
const NOISE_TOKENS = new Set([
  "ltda", "me", "mei", "eireli", "sa", "s/a", "ss", "epp", "cia", "companhia",
  "arquitetura", "arquiteto", "arquiteta", "studio", "escritorio", "de", "da",
  "do", "e", "em", "comercio", "servicos", "servico", "consultoria", "projeto",
  "projetos", "design", "interiores", "brasil", "br",
]);

const normalizeName = (s: string): string[] =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !NOISE_TOKENS.has(t));

// |tokens em comum| / |menor conjunto| — 1.0 quando um nome contém o outro
const nameSimilarity = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const common = a.filter(t => setB.has(t)).length;
  return common / Math.min(a.length, b.length);
};

const MATCH_THRESHOLD = 0.8;

/**
 * Busca CNPJ candidato por nome no Brasil.io. Retorna null sem token ou
 * quando nenhum candidato passa no match conservador.
 */
export const findCnpjByName = async (
  lead: ScraperResult
): Promise<string | null> => {
  const token = process.env.BRASILIO_TOKEN;
  if (!token) return null;

  const nameTokens = normalizeName(lead.nomeFantasia || lead.name || "");
  if (nameTokens.length === 0) return null;

  try {
    const params: Record<string, string> = {
      search: nameTokens.join(" "),
      page_size: "10",
    };
    if (lead.uf) params.uf = lead.uf.toUpperCase();

    const { data } = await axios.get(BRASILIO_URL, {
      params,
      headers: { Authorization: `Token ${token}`, ...UA },
      timeout: 15000,
    });

    for (const row of data.results || []) {
      const cnpj = String(row.cnpj || "").replace(/\D/g, "");
      if (cnpj.length !== 14) continue;

      // UF divergente descarta (quando o lead tem UF conhecida)
      if (lead.uf && row.uf && String(row.uf).toUpperCase() !== lead.uf.toUpperCase()) continue;

      const candidates = [row.razao_social, row.nome_fantasia]
        .filter(Boolean)
        .map(normalizeName);

      const hit = candidates.some(cand => nameSimilarity(nameTokens, cand) >= MATCH_THRESHOLD);
      if (hit) return cnpj;
    }
  } catch (err: any) {
    logger.warn(`[CrossEnrich] Brasil.io search falhou p/ "${lead.name}": ${err?.message}`);
  }
  return null;
};

// Preenche somente campos vazios do lead — dados da fonte original têm prioridade
const mergeIfEmpty = (lead: ScraperResult, enriched: ScraperResult): void => {
  const fields: (keyof ScraperResult)[] = [
    "cnpj", "razaoSocial", "nomeFantasia", "cnaeId", "cnaeDescricao",
    "naturezaJuridica", "situacao", "porte", "municipio", "uf",
    "email", "phone", "address",
  ];
  for (const f of fields) {
    if (!lead[f] && enriched[f]) (lead as any)[f] = enriched[f];
  }
};

/**
 * Se o lead não tem CNPJ, tenta localizá-lo na Receita pelo nome e enriquecer.
 * Best-effort: nunca lança — retorna o lead (possivelmente mutado).
 */
export const crossEnrichLead = async (lead: ScraperResult): Promise<ScraperResult> => {
  if (lead.cnpj) return lead;

  const cnpj = await findCnpjByName(lead);
  if (!cnpj) return lead;

  try {
    const enriched = await enrichCnpj(cnpj);
    if (enriched) {
      mergeIfEmpty(lead, enriched);
      lead.cnpj = lead.cnpj || cnpj;
      lead.enrichedFrom = [...(lead.enrichedFrom || []), "receita"];
      logger.info(`[CrossEnrich] "${lead.name}" → CNPJ ${cnpj} via Receita`);
    }
  } catch (err: any) {
    logger.warn(`[CrossEnrich] enrichCnpj(${cnpj}) falhou: ${err?.message}`);
  }
  return lead;
};
