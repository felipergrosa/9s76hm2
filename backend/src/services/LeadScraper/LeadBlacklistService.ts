import Setting from "../../models/Setting";
import { ScraperResult, ScraperFilters } from "../../models/LeadScraperJob";
import { toArray } from "./ScraperFilterUtils";
import logger from "../../utils/logger";

// Blacklist de leads aprendida por rejeição manual do usuário (ver POST
// /lead-scraper/jobs/:id/results/:index/feedback). Persistida na tabela
// Setting (key/value já escopado por companyId — mesma fábrica do
// ApifyTokenService, porém JSON não-secreto, sem criptografia). Consumida
// pelo QualityFilters em todo scrape/refilter da empresa.
const SETTING_KEY = "leadBlacklist";

// Caps defensivos: a lista só cresce por feedback — trim FIFO (os mais
// antigos saem primeiro) evita inchar o Setting indefinidamente.
const MAX_TERMS = 200;
const MAX_CATEGORIES = 100;

// Máximo de tokens distintos extraídos do nome por rejeição — evita poluir
// a blacklist com o nome inteiro do lead.
const MAX_TOKENS_PER_REJECTION = 2;

// Tokens genéricos demais para virar blacklist — bloqueariam nichos inteiros
const GENERIC_TOKENS = new Set([
  "servicos", "comercio", "brasil", "ltda", "eireli",
  "consultoria", "projeto", "projetos",
]);

export interface LeadBlacklist {
  terms: string[];
  categories: string[];
}

// lower + sem acento + só [a-z0-9] — mesma normalização do QualityFilters,
// garantindo que termo aprendido casa com o campo normalizado na filtragem
const normKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Parse seguro: qualquer valor corrompido/legado vira blacklist vazia
const parseBlacklist = (raw?: string | null): LeadBlacklist => {
  if (!raw) return { terms: [], categories: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      terms: Array.isArray(parsed?.terms) ? parsed.terms.map(String).filter(Boolean) : [],
      categories: Array.isArray(parsed?.categories) ? parsed.categories.map(String).filter(Boolean) : [],
    };
  } catch {
    return { terms: [], categories: [] };
  }
};

export const getCompanyBlacklist = async (companyId: number): Promise<LeadBlacklist> => {
  try {
    const setting = await Setting.findOne({ where: { companyId, key: SETTING_KEY } });
    return parseBlacklist(setting?.value);
  } catch (err: any) {
    // Best-effort: sem blacklist o scrape segue só com os filtros do usuário
    logger.warn(`[LeadBlacklist] falha ao ler blacklist (companyId=${companyId}): ${err?.message}`);
    return { terms: [], categories: [] };
  }
};

// Aprendizado por rejeição: a categoria do lead (ex.: "clínica de estética")
// vira entrada de `categories`; do nome/razão social saem até 2 tokens
// "assinatura" (≥5 chars, não-genéricos e que não façam parte das keywords/
// mapQueries do job — aprender "arquitetura" de uma rejeição mataria o
// nicho inteiro que o usuário pediu).
// Best-effort: NUNCA lança — falha aqui não pode derrubar o feedback.
export const learnFromRejection = async (
  companyId: number,
  lead: ScraperResult,
  jobFilters?: ScraperFilters
): Promise<void> => {
  try {
    const newCategories: string[] = [];
    const category = normKey(lead.category || "");
    if (category) newCategories.push(category);

    const asked = [
      ...toArray(jobFilters?.keywords),
      ...toArray(jobFilters?.keyword),
      ...toArray(jobFilters?.mapQueries),
    ].map(normKey);

    const tokens = new Set<string>();
    for (const source of [lead.name, lead.razaoSocial]) {
      for (const raw of String(source || "").split(/[^a-zA-Z0-9À-ÿ]+/)) {
        const t = normKey(raw);
        if (t.length < 5 || GENERIC_TOKENS.has(t)) continue;
        if (asked.some(k => k.includes(t))) continue;
        tokens.add(t);
        if (tokens.size >= MAX_TOKENS_PER_REJECTION) break;
      }
      if (tokens.size >= MAX_TOKENS_PER_REJECTION) break;
    }

    if (!newCategories.length && !tokens.size) return;

    const current = await getCompanyBlacklist(companyId);
    const terms = [...current.terms];
    for (const t of tokens) {
      if (!terms.includes(t)) terms.push(t);
    }
    const categories = [...current.categories];
    for (const c of newCategories) {
      if (!categories.includes(c)) categories.push(c);
    }

    const trimmed: LeadBlacklist = {
      terms: terms.slice(-MAX_TERMS),
      categories: categories.slice(-MAX_CATEGORIES),
    };

    const [setting] = await Setting.findOrCreate({
      where: { companyId, key: SETTING_KEY },
      defaults: { companyId, key: SETTING_KEY, value: "{}" } as any,
    });
    await setting.update({ value: JSON.stringify(trimmed) });
    logger.info(
      `[LeadBlacklist] companyId=${companyId}: +${tokens.size} termo(s)/+${newCategories.length} categoria(s) aprendidos (total ${trimmed.terms.length}t/${trimmed.categories.length}c)`
    );
  } catch (err: any) {
    logger.warn(`[LeadBlacklist] learnFromRejection falhou (companyId=${companyId}): ${err?.message}`);
  }
};
