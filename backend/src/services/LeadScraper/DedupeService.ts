import { Op } from "sequelize";
import LeadScraperJob, { ScraperResult } from "../../models/LeadScraperJob";
import Contact from "../../models/Contact";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import logger from "../../utils/logger";

// Dedupe robusto entre TODAS as abas do captador: um lead já visto em
// qualquer job anterior da empresa (qualquer source) não deve reaparecer.
// Chaves de identidade, em ordem de confiabilidade: CNPJ > telefone canônico
// > handle do Instagram. Um lead sem nenhuma dessas chaves não é deduplicável
// e sempre passa (não há como saber se é o mesmo).

const normPhone = (v?: string): string | null => {
  if (!v) return null;
  const { canonical } = safeNormalizePhoneNumber(v);
  return canonical;
};

const normHandle = (v?: string): string | null =>
  v ? v.trim().toLowerCase().replace(/^@+/, "") : null;

interface SeenSets {
  cnpjs: Set<string>;
  phones: Set<string>;
  instagrams: Set<string>;
}

// Varre resultados de jobs anteriores (done) da empresa e monta os sets de
// chaves já vistas. Também inclui contatos já importados (Contact.cpfCnpj /
// canonicalNumber / instagram) — cobre leads trazidos por fora do scraper.
async function loadSeenKeys(companyId: number): Promise<SeenSets> {
  const seen: SeenSets = { cnpjs: new Set(), phones: new Set(), instagrams: new Set() };

  const priorJobs = await LeadScraperJob.findAll({
    where: { companyId, status: "done" },
    attributes: ["results"]
  });
  for (const job of priorJobs) {
    for (const r of job.results || []) {
      if (r.cnpj) seen.cnpjs.add(r.cnpj.replace(/\D/g, ""));
      const p = normPhone(r.phone);
      if (p) seen.phones.add(p);
      const h = normHandle(r.instagram);
      if (h) seen.instagrams.add(h);
    }
  }

  const contacts = await Contact.findAll({
    where: {
      companyId,
      [Op.or]: [
        { cpfCnpj: { [Op.ne]: null } },
        { canonicalNumber: { [Op.ne]: null } },
        { instagram: { [Op.ne]: null } }
      ]
    },
    attributes: ["cpfCnpj", "canonicalNumber", "instagram"]
  });
  for (const c of contacts) {
    if (c.cpfCnpj) seen.cnpjs.add(String(c.cpfCnpj).replace(/\D/g, ""));
    if (c.canonicalNumber) seen.phones.add(String(c.canonicalNumber));
    const h = normHandle(c.instagram);
    if (h) seen.instagrams.add(h);
  }

  return seen;
}

// Marca duplicatas DENTRO do próprio lote (evita reintroduzir o mesmo lead
// duas vezes quando o motor de busca retorna registros repetidos).
function dedupeWithinBatch(results: ScraperResult[], seen: SeenSets): ScraperResult[] {
  const localCnpjs = new Set<string>();
  const localPhones = new Set<string>();
  const localHandles = new Set<string>();
  const out: ScraperResult[] = [];

  for (const r of results) {
    const cnpj = r.cnpj ? r.cnpj.replace(/\D/g, "") : null;
    const phone = normPhone(r.phone);
    const handle = normHandle(r.instagram);

    const isDup =
      (cnpj && (seen.cnpjs.has(cnpj) || localCnpjs.has(cnpj))) ||
      (phone && (seen.phones.has(phone) || localPhones.has(phone))) ||
      (handle && (seen.instagrams.has(handle) || localHandles.has(handle)));

    if (isDup) continue;

    if (cnpj) localCnpjs.add(cnpj);
    if (phone) localPhones.add(phone);
    if (handle) localHandles.add(handle);
    out.push(r);
  }

  return out;
}

// skipDuplicates=false desativa o filtro (usuário pode querer recapturar de
// propósito, ex.: revalidar dados antigos). Default: true.
export const filterOutDuplicates = async (
  companyId: number,
  results: ScraperResult[],
  skipDuplicates?: boolean
): Promise<ScraperResult[]> => {
  if (skipDuplicates === false || !results.length) return results;

  try {
    const seen = await loadSeenKeys(companyId);
    const before = results.length;
    const filtered = dedupeWithinBatch(results, seen);
    const removed = before - filtered.length;
    if (removed > 0) {
      logger.info(`[LeadScraper/Dedupe] companyId=${companyId}: ${removed} lead(s) duplicado(s) removido(s) de ${before}`);
    }
    return filtered;
  } catch (err: any) {
    // Best-effort: falha no dedupe nunca deve derrubar o job de captura
    logger.warn(`[LeadScraper/Dedupe] falhou (companyId=${companyId}): ${err?.message}`);
    return results;
  }
};
