import { Op } from "sequelize";
import LeadScraperJob, { ScraperResult } from "../../models/LeadScraperJob";
import Contact from "../../models/Contact";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
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
  places: Set<string>;
}

// Origem mais forte em que a chave já foi vista. A prioridade entre origens
// (seen_contact > seen_list > seen_job) é resolvida na CARGA: cada fonte é
// gravada na ordem crescente de prioridade e a última escrita sobrescreve.
type SeenOrigin =
  | { status: "seen_job"; jobId: number }
  | { status: "seen_list"; contactListId: number }
  | { status: "seen_contact"; contactId: number };

interface SeenKeyMaps {
  cnpjs: Map<string, SeenOrigin>;
  phones: Map<string, SeenOrigin>;
  instagrams: Map<string, SeenOrigin>;
  places: Map<string, SeenOrigin>;
}

interface SeenData {
  maps: SeenKeyMaps;
  // chaves de leads marcados como "bad" pelo usuário — match no classifyResults
  // vira rejeição automática (lead rejeitado nunca reaparece numa busca nova)
  rejected: SeenSets;
}

// Varre as fontes de "já visto" da empresa e monta mapas chave → origem:
// 1) results de jobs anteriores done/cancelled (cancelado conta: os leads
//    parciais capturados até o cancelamento são válidos);
// 2) canonicalNumbers de ContactListItem (join ContactList p/ isolar por
//    empresa) — leads já importados para uma lista;
// 3) Contacts da empresa (cpfCnpj / canonicalNumber / instagram) — cobre
//    leads trazidos por fora do scraper e é a origem mais forte.
// 4) resultados com verdict "bad" em jobs anteriores alimentam o mapa
//    `rejected` paralelo — rejeitado pelo usuário tem precedência máxima.
// O job em execução não entra: seu status é "running"/"pending" e seus
// results ainda estão vazios neste ponto do pipeline.
async function loadSeenKeys(companyId: number): Promise<SeenData> {
  const seen: SeenKeyMaps = {
    cnpjs: new Map(),
    phones: new Map(),
    instagrams: new Map(),
    places: new Map()
  };
  const rejected: SeenSets = {
    cnpjs: new Set(),
    phones: new Set(),
    instagrams: new Set(),
    places: new Set()
  };

  const priorJobs = await LeadScraperJob.findAll({
    where: { companyId, status: { [Op.in]: ["done", "cancelled"] } },
    attributes: ["id", "results"]
  });
  for (const job of priorJobs) {
    for (const r of job.results || []) {
      const origin: SeenOrigin = { status: "seen_job", jobId: job.id };
      const cnpj = r.cnpj ? r.cnpj.replace(/\D/g, "") : "";
      const p = normPhone(r.phone);
      const h = normHandle(r.instagram);
      const place = r.placeId?.trim() || "";
      if (cnpj) seen.cnpjs.set(cnpj, origin);
      if (p) seen.phones.set(p, origin);
      if (h) seen.instagrams.set(h, origin);
      if (place) seen.places.set(place, origin);
      if (r.verdict === "bad") {
        if (cnpj) rejected.cnpjs.add(cnpj);
        if (p) rejected.phones.add(p);
        if (h) rejected.instagrams.add(h);
        if (place) rejected.places.add(place);
      }
    }
  }

  const listItems = await ContactListItem.findAll({
    where: { canonicalNumber: { [Op.ne]: null } },
    attributes: ["canonicalNumber", "contactListId"],
    include: [
      {
        model: ContactList,
        attributes: [],
        where: { companyId },
        required: true // inner join — itens de listas de outras empresas fora
      }
    ]
  });
  for (const item of listItems) {
    if (!item.canonicalNumber) continue;
    seen.phones.set(item.canonicalNumber, {
      status: "seen_list",
      contactListId: item.contactListId
    });
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
    attributes: ["id", "cpfCnpj", "canonicalNumber", "instagram"]
  });
  for (const c of contacts) {
    const origin: SeenOrigin = { status: "seen_contact", contactId: c.id };
    if (c.cpfCnpj) seen.cnpjs.set(String(c.cpfCnpj).replace(/\D/g, ""), origin);
    if (c.canonicalNumber) seen.phones.set(String(c.canonicalNumber), origin);
    const h = normHandle(c.instagram);
    if (h) seen.instagrams.set(h, origin);
  }

  return { maps: seen, rejected };
}

// Marca duplicatas DENTRO do próprio lote (evita reintroduzir o mesmo lead
// duas vezes quando o motor de busca retorna registros repetidos).
function dedupeWithinBatch(results: ScraperResult[], seen: SeenSets): ScraperResult[] {
  const localCnpjs = new Set<string>();
  const localPhones = new Set<string>();
  const localHandles = new Set<string>();
  const localPlaces = new Set<string>();
  const out: ScraperResult[] = [];

  for (const r of results) {
    const cnpj = r.cnpj ? r.cnpj.replace(/\D/g, "") : null;
    const phone = normPhone(r.phone);
    const handle = normHandle(r.instagram);
    const place = r.placeId?.trim() || null;

    const isDup =
      (cnpj && (seen.cnpjs.has(cnpj) || localCnpjs.has(cnpj))) ||
      (phone && (seen.phones.has(phone) || localPhones.has(phone))) ||
      (handle && (seen.instagrams.has(handle) || localHandles.has(handle))) ||
      (place && (seen.places.has(place) || localPlaces.has(place)));

    if (isDup) continue;

    if (cnpj) localCnpjs.add(cnpj);
    if (phone) localPhones.add(phone);
    if (handle) localHandles.add(handle);
    if (place) localPlaces.add(place);
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
    const { maps } = await loadSeenKeys(companyId);
    // dedupeWithinBatch só precisa saber SE a chave já foi vista — a origem
    // (job/list/contact) é usada apenas pela classificação
    const seen: SeenSets = {
      cnpjs: new Set(maps.cnpjs.keys()),
      phones: new Set(maps.phones.keys()),
      instagrams: new Set(maps.instagrams.keys()),
      places: new Set(maps.places.keys())
    };
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

// Prioridade de status na resolução final: contato > lista > job anterior.
// Quando mais de uma chave do lead casa (ex.: CNPJ visto num job e telefone
// já é Contact), vence a origem mais forte — a informação mais útil pro
// usuário. Empate de status é desempatado pela prioridade de chave
// (cnpj > phone > instagram), que decide qual dedupeInfo reportar.
const STATUS_RANK: Record<string, number> = {
  seen_contact: 0,
  seen_list: 1,
  seen_job: 2
};

// Classifica cada lead do lote MUTANDO o objeto (dedupeStatus/dedupeInfo/
// existsInContacts) — contrato consumido pelo frontend e pelo import.
// Chaves de identidade por prioridade: cnpj (só dígitos) > telefone canônico
// > handle do Instagram. Lead sem nenhuma chave → "new".
export const classifyResults = async (
  companyId: number,
  results: ScraperResult[]
): Promise<void> => {
  if (!results.length) return;

  try {
    const { maps: seen, rejected } = await loadSeenKeys(companyId);

    for (const r of results) {
      const cnpj = r.cnpj ? r.cnpj.replace(/\D/g, "") : null;
      const phone = normPhone(r.phone);
      const handle = normHandle(r.instagram);
      const place = r.placeId?.trim() || null;

      // Rejeição manual tem precedência máxima: casou por qualquer chave,
      // o lead novo herda verdict "bad" + seen_job — o classifyAndPrune já o
      // remove do array sem custo extra (e o front/import nunca o vê).
      const isRejected =
        (cnpj && rejected.cnpjs.has(cnpj)) ||
        (phone && rejected.phones.has(phone)) ||
        (handle && rejected.instagrams.has(handle)) ||
        (place && rejected.places.has(place));
      if (isRejected) {
        r.verdict = "bad";
        r.dedupeStatus = "seen_job";
        continue;
      }

      // Cada entrada é (origem, prioridade da chave que casou)
      const candidates: Array<{ origin: SeenOrigin; keyRank: number }> = [];

      if (cnpj) {
        const origin = seen.cnpjs.get(cnpj);
        if (origin) candidates.push({ origin, keyRank: 0 });
      }

      if (phone) {
        const origin = seen.phones.get(phone);
        if (origin) candidates.push({ origin, keyRank: 1 });
      }

      if (handle) {
        const origin = seen.instagrams.get(handle);
        if (origin) candidates.push({ origin, keyRank: 2 });
      }

      // placeId do Maps: identidade estável — mesmo lugar reaparece com
      // nome/telefone diferentes em buscas distintas; rank baixo (fallback
      // de quem não tem CNPJ/telefone/IG)
      if (place) {
        const origin = seen.places.get(place);
        if (origin) candidates.push({ origin, keyRank: 3 });
      }

      if (!candidates.length) {
        // Sem chave ou sem match — lead inédito para a empresa
        r.dedupeStatus = "new";
        continue;
      }

      candidates.sort(
        (a, b) =>
          STATUS_RANK[a.origin.status] - STATUS_RANK[b.origin.status] ||
          a.keyRank - b.keyRank
      );
      const best = candidates[0].origin;

      r.dedupeStatus = best.status;
      r.dedupeInfo = {
        jobId: best.status === "seen_job" ? best.jobId : undefined,
        contactListId: best.status === "seen_list" ? best.contactListId : undefined,
        contactId: best.status === "seen_contact" ? best.contactId : undefined
      };
      if (best.status === "seen_contact") r.existsInContacts = true;
    }
  } catch (err: any) {
    // Best-effort: sem flags o fluxo segue como antes (retrocompat — result
    // sem dedupeStatus é tratado como "new" por job service e import)
    logger.warn(`[LeadScraper/Dedupe] classifyResults falhou (companyId=${companyId}): ${err?.message}`);
  }
};
