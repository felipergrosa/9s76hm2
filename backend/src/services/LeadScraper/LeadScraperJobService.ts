import { Op } from "sequelize";
import LeadScraperJob, { ScraperFilters, ScraperResult } from "../../models/LeadScraperJob";
import { scrapeGoogleMaps } from "./GoogleMapsScraperService";
import { enrichCnpj } from "./CnpjEnricherService";
import { searchCnpjsByFilters } from "./CnpjSearchService";
import { enrichLeadSocials } from "./SocialEnricherService";
import { scrapeConselho } from "./ConselhoScraperService";
import { isSidecarAvailable, scrapeViaSidecar } from "./GmapsSidecarService";
import { isApifyConfigured, scrapeFollowersViaApify, enrichProfilesBatchViaApify } from "../Instagram/InstagramApifyProvider";
import { isGmapsApifyConfigured, scrapeGoogleMapsViaApify } from "./GoogleMapsApifyProvider";
import { crossEnrichLead } from "./CrossEnricherService";
import CheckContactNumber from "../WbotServices/CheckNumber";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { toArray, resolveMaxResults } from "./ScraperFilterUtils";
import { filterOutDuplicates } from "./DedupeService";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Normaliza telefones assim que o scraping bruto termina — feedback em tempo
// real na tabela (antes do enriquecimento social/WhatsApp rodar).
function normalizePhonesInPlace(results: ScraperResult[]): void {
  for (const r of results) {
    if (r.phone) {
      const { canonical } = safeNormalizePhoneNumber(r.phone);
      if (canonical) r.phone = canonical;
    }
  }
}

// Cancelamento cooperativo: requestJobCancel sinaliza; checkpoints nos loops
// abortam com JobCancelledError (pego no catch de runScraperJob, que mantém o
// status "cancelled" gravado pelo controller — nao vira "error").
class JobCancelledError extends Error {}
const cancelRequested = new Set<number>();
export const requestJobCancel = (jobId: number) => { cancelRequested.add(jobId); };
const throwIfCancelled = (jobId: number) => {
  if (cancelRequested.has(jobId)) throw new JobCancelledError();
};

// Enriquecimento cruzado: leads sem CNPJ tentam ser localizados na Receita
// Federal por nome (Brasil.io) e enriquecidos pela cascata OpenCNPJ →
// minhareceita → BrasilAPI. Progresso: 80→88.
async function runCrossEnrichment(job: LeadScraperJob, results: ScraperResult[]): Promise<void> {
  const targets = results.filter(r => !r.cnpj && (r.name || r.nomeFantasia));
  if (!targets.length) {
    await job.update({ progress: 88 });
    return;
  }
  let done = 0;
  for (const lead of targets) {
    throwIfCancelled(job.id);
    await crossEnrichLead(lead).catch(() => {});
    done++;
    if (done % 5 === 0 || done === targets.length) {
      await job.update({
        results: [...results],
        progress: 80 + Math.round((done / targets.length) * 8)
      });
    }
    await delay(300); // throttle Brasil.io
  }
}

// Validação WhatsApp: normaliza todos os telefones e, se a empresa tiver
// sessão Baileys conectada, consulta onWhatsApp por lead (throttle 800ms —
// read-only, mas volume alto pode flaggear a sessão). Progresso: 96→99.
async function runWhatsappValidation(job: LeadScraperJob, results: ScraperResult[]): Promise<void> {
  // Normalização sempre acontece — independente de sessão WA
  for (const r of results) {
    if (r.phone) {
      const { canonical } = safeNormalizePhoneNumber(r.phone);
      if (canonical) r.phone = canonical;
    }
  }

  const candidates = results.filter(r => r.phone);
  let canCheck = false;
  try {
    const wa = await GetDefaultWhatsApp(null, job.companyId);
    // API oficial (Meta) não expõe onWhatsApp — só Baileys/web
    canCheck = wa.channelType !== "official";
  } catch {
    canCheck = false;
  }

  if (!canCheck || !candidates.length) {
    if (candidates.length && !canCheck) {
      logger.info(`[LeadScraperJob] jobId=${job.id}: sem sessão WhatsApp Baileys ativa — telefones apenas normalizados`);
    }
    await job.update({ results: [...results], progress: 99 });
    return;
  }

  let done = 0;
  for (const lead of candidates) {
    throwIfCancelled(job.id);
    try {
      const jid = await CheckContactNumber(lead.phone!, job.companyId);
      lead.hasWhatsapp = true;
      lead.whatsappChecked = true;
      if (jid) lead.phone = jid; // número verificado e normalizado pela sessão
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/não está cadastrado|not registered|n.*o existe/i.test(msg)) {
        lead.hasWhatsapp = false;
        lead.whatsappChecked = true;
      } else if (msg.includes("ERR_WAPP_NOT_INITIALIZED")) {
        // Sessão caiu — aborta a validação sem marcar o restante
        logger.warn(`[LeadScraperJob] jobId=${job.id}: sessão WhatsApp indisponível durante validação`);
        break;
      }
      // demais erros (timeout, rede): não conclusivo — whatsappChecked fica false
    }
    done++;
    if (done % 10 === 0 || done === candidates.length) {
      await job.update({
        results: [...results],
        progress: 96 + Math.round((done / candidates.length) * 3)
      });
    }
    await delay(800);
  }
  await job.update({ results: [...results], progress: 99 });
}

// Enriquecimento IG em lote: 1 run do profile-scraper cobre todos os handles
// (chunks de 100), trazendo telefone/email/site/categoria de perfis business.
// Muito mais barato e rápido que 1 run por lead. Progresso: 88→96.
async function runIgBatchEnrichment(job: LeadScraperJob, results: ScraperResult[]): Promise<void> {
  const handles = results.map(r => r.instagram).filter(Boolean) as string[];
  if (!handles.length || !(await isApifyConfigured(job.companyId))) {
    await job.update({ progress: 96 });
    return;
  }
  const profiles = await enrichProfilesBatchViaApify(
    handles,
    job.companyId,
    async (current, total) => {
      throwIfCancelled(job.id);
      await job.update({ progress: 88 + Math.round((current / Math.max(total, 1)) * 8) });
    }
  );
  let enriched = 0;
  for (const r of results) {
    const p = profiles.get(String(r.instagram || "").toLowerCase());
    if (!p) continue;
    enriched++;
    if (!r.phone && p.phone) r.phone = p.phone;
    if (!r.email && p.email) r.email = p.email;
    if (!r.website && p.website) r.website = p.website;
    if (!r.category && p.category) r.category = p.category;
    if (!r.name && p.name) r.name = p.name;
  }
  logger.info(`[LeadScraperJob] jobId=${job.id}: batch IG enriqueceu ${enriched}/${results.length} leads`);
  await job.update({ results: [...results], progress: 96 });
}

// Enriquecimento social (progresso parametrizável — default 88→96).
// Updates DB every 5 leads to reduce write load. Usa Apify (instagram-profile-scraper)
// quando configurado — sem sessão pessoal, sem risco de ban.
async function runSocialEnrichment(job: LeadScraperJob, results: ScraperResult[], fromPct = 88, toPct = 96): Promise<void> {
  for (let i = 0; i < results.length; i++) {
    throwIfCancelled(job.id);
    try {
      const socials = await enrichLeadSocials(results[i], job.companyId);
      Object.assign(results[i], socials);
    } catch {
      // best-effort — enriquecimento social nunca derruba o job
    }

    // Telefone em tempo real: normaliza assim que o lead sai do enriquecimento social
    if (results[i].phone) {
      const { canonical } = safeNormalizePhoneNumber(results[i].phone);
      if (canonical) results[i].phone = canonical;
    }

    if ((i + 1) % 5 === 0 || i === results.length - 1) {
      const p = fromPct + Math.round(((i + 1) / results.length) * (toPct - fromPct));
      await job.update({ results: [...results], progress: p });
    }
  }
}

export const createScraperJob = async (
  companyId: number,
  // "conselho" é fonte futura — aceita no contrato, sem branch de execução ainda
  source: "google_maps" | "cnpj" | "cnpj_search" | "ig_followers" | "conselho" | "global",
  filters: ScraperFilters
) => {
  return LeadScraperJob.create({
    companyId,
    source,
    filters,
    status: "pending",
    results: [],
    progress: 0,
    totalFound: 0
  } as any);
};

export const runScraperJob = async (jobId: number) => {
  // Referência externa p/ o catch conseguir persistir o status de erro
  let jobRef: LeadScraperJob | null = null;
  try {
    const job = await LeadScraperJob.findByPk(jobId);
    if (!job) return;
    jobRef = job;

    // Idempotência: só executa se ainda estiver pendente (evita re-run em retry da fila)
    if (job.status !== "pending") return;

    await job.update({ status: "running", progress: 0 });

    if (job.source === "google_maps") {
      const { keyword = "", city, state, maxResults, lat, lng, radiusKm } = job.filters;
      // Busca por área no mapa tem precedência sobre cidade/UF
      const geo = typeof lat === "number" && typeof lng === "number"
        ? { lat, lng, radiusKm: radiusKm || 5 }
        : undefined;

      // Multi-select: cada cidade × cada UF vira uma query "cidade UF" separada
      // (motores de Maps não têm operador OR de localização — precisa rodar N buscas).
      const cities = toArray(city);
      const states = toArray(state);
      const cityQueries: string[] = geo
        ? [""] // geo mode: uma única query, localização vem das coords
        : cities.length
          ? (states.length ? cities.flatMap(c => states.map(s => `${c} ${s}`)) : cities)
          : states.length
            ? states
            : [""];

      const cap = resolveMaxResults(maxResults, 1000);
      const perQueryCap = Math.max(1, Math.ceil(cap / cityQueries.length));

      // Ordem de precedência dos motores de busca: Apify (compass~crawler-google-places,
      // mais estável/escalável) → sidecar gosom/google-maps-scraper (GMAPS_SCRAPER_URL) →
      // Puppeteer local (fallback sempre disponível, mais sujeito a bloqueio do Google).
      const useApify = await isGmapsApifyConfigured(job.companyId);
      const useSidecar = !useApify && (await isSidecarAvailable());
      const engine = useApify ? "apify" : useSidecar ? "sidecar" : "puppeteer";
      logger.info(`[LeadScraperJob] jobId=${job.id} google_maps via ${engine} (${cityQueries.length} query(ies))${geo ? ` geo(${lat},${lng},${geo.radiusKm}km)` : ""}`);

      const results: ScraperResult[] = [];
      for (let qi = 0; qi < cityQueries.length; qi++) {
        throwIfCancelled(job.id);
        if (results.length >= cap) break;
        const cityQuery = cityQueries[qi];
        const onProgress = async (current: number, total: number) => {
          throwIfCancelled(job.id);
          const queryShare = 80 / cityQueries.length;
          const p = qi * queryShare + (current / Math.max(total, 1)) * queryShare;
          await job.update({ progress: Math.round(p) });
        };
        const remaining = Math.min(perQueryCap, cap - results.length);
        const queryResults = useApify
          ? await scrapeGoogleMapsViaApify(keyword, cityQuery, remaining, onProgress, { state: states[0], geo, companyId: job.companyId })
          : useSidecar
            ? await scrapeViaSidecar(keyword, cityQuery, remaining, onProgress, geo)
            : await scrapeGoogleMaps(keyword, cityQuery, remaining, onProgress, { state: states[0], geo });
        results.push(...queryResults);
      }

      normalizePhonesInPlace(results);
      const deduped = await filterOutDuplicates(job.companyId, results, job.filters.skipDuplicates);
      await job.update({ results: deduped, totalFound: deduped.length, progress: 80 });
      await runCrossEnrichment(job, deduped);
      await runSocialEnrichment(job, deduped);
      await runWhatsappValidation(job, deduped);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "cnpj") {
      const cnpjs = job.filters.cnpjs || [];
      const results: ScraperResult[] = [];

      for (let i = 0; i < cnpjs.length; i++) {
        throwIfCancelled(job.id);
        const enriched = await enrichCnpj(cnpjs[i]);
        if (enriched) results.push(enriched);
        await job.update({ progress: Math.round(((i + 1) / cnpjs.length) * 80) });
        await delay(350); // BrasilAPI: safe at ~3 req/sec
      }

      normalizePhonesInPlace(results);
      await job.update({ results, totalFound: results.length, progress: 80 });
      // cross-enrich desnecessário: leads já vêm da Receita Federal
      await runSocialEnrichment(job, results);
      await runWhatsappValidation(job, results);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "cnpj_search") {
      const results = await searchCnpjsByFilters(
        job.filters,
        async (current, total) => {
          throwIfCancelled(job.id);
          await job.update({ progress: Math.round((current / total) * 80) });
        }
      );
      normalizePhonesInPlace(results);
      await job.update({ results, totalFound: results.length, progress: 80 });
      await runSocialEnrichment(job, results);
      await runWhatsappValidation(job, results);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "ig_followers") {
      const { igTargetHandle = "", maxResults = 500 } = job.filters;

      if (!(await isApifyConfigured(job.companyId))) {
        throw new Error("APIFY_TOKEN não configurado. Configure em Configurações → Lead Scraper para buscar seguidores do Instagram.");
      }
      const results = await scrapeFollowersViaApify(
        igTargetHandle,
        maxResults,
        async (current, total) => {
          throwIfCancelled(job.id);
          await job.update({ progress: Math.round((current / total) * 80) });
        },
        job.companyId
      );
      normalizePhonesInPlace(results);
      await job.update({ results, totalFound: results.length, progress: 80 });
      await runCrossEnrichment(job, results);
      // Batch: 1 run cobre todos os perfis; fallback per-lead se falhar
      const batchOk = await runIgBatchEnrichment(job, results)
        .then(() => true)
        .catch(async (err: any) => {
          if (err instanceof JobCancelledError || cancelRequested.has(job.id)) throw err;
          logger.warn(`[LeadScraperJob] jobId=${job.id}: batch IG falhou (${err.message}) — fallback per-lead`);
          return false;
        });
      if (!batchOk) await runSocialEnrichment(job, results);
      await runWhatsappValidation(job, results);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "conselho") {
      const results = await scrapeConselho(
        job.filters,
        async (current, total) => {
          throwIfCancelled(job.id);
          await job.update({ progress: Math.round((current / total) * 80) });
        }
      );
      normalizePhonesInPlace(results);
      await job.update({ results, totalFound: results.length, progress: 80 });
      await runCrossEnrichment(job, results);
      await runSocialEnrichment(job, results);
      await runWhatsappValidation(job, results);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "global") {
      // Busca multi-fonte: Maps + Receita + conselhos em paralelo, com merge
      // por identidade (CNPJ/telefone/IG/nome+UF). Fases: 0-70 scrape paralelo,
      // 70-75 merge+dedupe, depois o pipeline normal de enriquecimento.
      const { runGlobalSearch } = await import("./GlobalSearchService");
      const merged = await runGlobalSearch({
        companyId: job.companyId,
        filters: job.filters,
        checkCancelled: () => throwIfCancelled(job.id),
        onProgress: async (pct) => {
          throwIfCancelled(job.id);
          await job.update({ progress: Math.round(pct * 0.7) });
        },
      });

      normalizePhonesInPlace(merged);
      const deduped = await filterOutDuplicates(job.companyId, merged, job.filters.skipDuplicates);
      await job.update({ results: deduped, totalFound: deduped.length, progress: 75 });
      // Fontes já fornecem CNPJ quando possível — cross ainda vale para Maps sem CNPJ
      await runCrossEnrichment(job, deduped);
      await runSocialEnrichment(job, deduped);
      await runWhatsappValidation(job, deduped);
      throwIfCancelled(job.id);
      await job.update({ status: "done", progress: 100 });

    } else {
      await job.update({ status: "error", errorMessage: "source desconhecido" });
    }
  } catch (err: any) {
    if (err instanceof JobCancelledError || cancelRequested.has(jobId)) {
      // cancelado pelo usuario: controller ja gravou status "cancelled"
      logger.info(`[LeadScraperJob] jobId=${jobId} cancelado pelo usuário`);
      cancelRequested.delete(jobId);
      return;
    }
    logger.error(`[LeadScraperJob] jobId=${jobId} error: ${err.message}`);
    if (jobRef) {
      await jobRef.update({ status: "error", errorMessage: err.message, progress: 0 }).catch((e: any) => {
        logger.error(`[LeadScraperJob] jobId=${jobId} falha ao persistir status de erro: ${e.message}`);
      });
    }
  }
};

// Recovery no boot: jobs presos em pending/running há mais de 10 min viram "error"
export const recoverOrphanScraperJobs = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const [affected] = await LeadScraperJob.update(
    { status: "error", errorMessage: "interrompido por restart do servidor" },
    { where: { status: { [Op.in]: ["pending", "running"] }, updatedAt: { [Op.lt]: cutoff } } }
  );
  if (affected > 0) {
    logger.warn(`[LeadScraperJob] ${affected} job(s) órfão(s) marcado(s) como error após restart`);
  }
};
