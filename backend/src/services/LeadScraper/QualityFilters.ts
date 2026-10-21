import { ScraperResult, ScraperFilters } from "../../models/LeadScraperJob";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { toArray } from "./ScraperFilterUtils";
import logger from "../../utils/logger";

// Pós-filtros de qualidade "baratos": rodam sobre os resultados brutos/merged
// ANTES dos enriquecimentos caros (social, cross, WhatsApp). Todos opt-in —
// filtro ausente não corta nada.
// Convenção: campos que o merge pode trazer de outra fonte (rating, situacao,
// porte, dataAbertura) são FAIL-OPEN quando vazios; campos essenciais ao
// objetivo do filtro (celular p/ WhatsApp, website, nome) são FAIL-CLOSED.

// lower + sem acento + só [a-z0-9] — casa termos ignorando caixa/espaços/pontuação
const normKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// upper + sem acento (mantém espaços) — para frases tipo "EMPRESARIO INDIVIDUAL"
const normUpper = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

const parseRating = (v?: string): number | null => {
  const n = parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Aceita "YYYY-MM-DD" (Receita) e "DD/MM/YYYY" — comparação por string ISO
const toIsoDate = (v?: string): string => {
  const s = String(v || "").trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : "";
};

// celular BR canônico: 55 + DDD(2) + 9 + 8 dígitos
const CELL_BR_REGEX = /^55\d{2}9\d{8}$/;

export const applyQualityPostFilters = (
  results: ScraperResult[],
  filters: ScraperFilters
): ScraperResult[] => {
  const f = filters || {};
  const keywords = toArray(f.excludeKeywords).map(normKey).filter(Boolean);
  const situacoes = toArray(f.situacao).map(normUpper).filter(Boolean);
  const minAbertura = toIsoDate(f.dataAberturaMin);
  const maxAbertura = toIsoDate(f.dataAberturaMax);

  const removed: Record<string, number> = {};
  const drop = (reason: string) => { removed[reason] = (removed[reason] || 0) + 1; };

  const kept = results.filter(r => {
    // rating/reviews: fail-open — ausente pode vir de outra fonte no merge
    if (typeof f.minRating === "number") {
      const rating = parseRating(r.rating);
      if (rating !== null && rating < f.minRating) { drop("minRating"); return false; }
    }
    if (typeof f.minReviews === "number" && f.minReviews > 0) {
      if (r.reviewsCount !== undefined && r.reviewsCount < f.minReviews) { drop("minReviews"); return false; }
    }

    // blacklist de nome: fail-closed (todo lead tem algum nome/razão/fantasia)
    if (keywords.length) {
      const names = [r.name, r.razaoSocial, r.nomeFantasia].map(v => normKey(v || ""));
      if (names.some(n => n && keywords.some(k => n.includes(k)))) { drop("excludeKeywords"); return false; }
    }

    // sem celular BR não serve p/ campanha de WhatsApp — fail-closed
    if (f.onlyCellPhone) {
      const { canonical } = safeNormalizePhoneNumber(r.phone);
      if (!canonical || !CELL_BR_REGEX.test(canonical)) { drop("onlyCellPhone"); return false; }
    }

    if (f.onlyWithWebsite && !r.website) { drop("onlyWithWebsite"); return false; }
    if (f.onlyWithoutWebsite && r.website) { drop("onlyWithoutWebsite"); return false; }

    // MEI/EI: fail-open se a RF não preencheu nem porte nem natureza jurídica
    if (f.excludeMei) {
      const porte = normUpper(r.porte || "");
      const nj = normUpper(r.naturezaJuridica || "");
      const njCodigo = (r.naturezaJuridica || "").match(/\d{3,4}/)?.[0] || "";
      if (porte.includes("MEI") || nj.includes("EMPRESARIO INDIVIDUAL") || (njCodigo && njCodigo.startsWith("213"))) {
        drop("excludeMei");
        return false;
      }
    }

    // situacao: vale p/ leads merged também — fail-open quando a fonte não traz
    if (situacoes.length && r.situacao) {
      const sit = normUpper(r.situacao);
      if (!situacoes.some(v => sit.includes(v))) { drop("situacao"); return false; }
    }

    if ((minAbertura || maxAbertura) && r.dataAbertura) {
      const iso = toIsoDate(r.dataAbertura);
      if (iso && ((minAbertura && iso < minAbertura) || (maxAbertura && iso > maxAbertura))) {
        drop("dataAbertura");
        return false;
      }
    }

    return true;
  });

  if (kept.length !== results.length) {
    logger.info(`[QualityFilters] ${results.length} → ${kept.length} leads (removidos: ${JSON.stringify(removed)})`);
  }
  return kept;
};
