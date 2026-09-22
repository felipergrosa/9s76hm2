import { Op } from "sequelize";
import LeadScraperJob, { ScraperFilters, ScraperResult } from "../../models/LeadScraperJob";
import { scrapeGoogleMaps } from "./GoogleMapsScraperService";
import { enrichCnpj } from "./CnpjEnricherService";
import { searchCnpjsByFilters } from "./CnpjSearchService";
import { enrichLeadSocials } from "./SocialEnricherService";
import { getSessionCookies, markSessionExpired } from "../Instagram/InstagramAuthService";
import { InstagramBrowserSession } from "../Instagram/InstagramProfileService";
import { scrapeFollowers } from "../Instagram/InstagramFollowersService";
import { scrapeConselho } from "./ConselhoScraperService";
import { isSidecarAvailable, scrapeViaSidecar } from "./GmapsSidecarService";
import { isApifyConfigured, scrapeFollowersViaApify } from "../Instagram/InstagramApifyProvider";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Runs after main scraping (progress 90-100%). Updates DB every 5 leads to reduce write load.
// Opens ONE browser session for all Instagram profile visits — faster and less detectable than per-lead browser.
async function runSocialEnrichment(job: LeadScraperJob, results: ScraperResult[]): Promise<void> {
  const igCookies = await getSessionCookies(job.companyId).catch(() => null);
  let igSession: InstagramBrowserSession | null = null;

  if (igCookies) {
    igSession = await InstagramBrowserSession.create(igCookies).catch(err => {
      logger.warn(`[Instagram] Failed to create browser session: ${err.message}`);
      return null;
    });
  }

  try {
    for (let i = 0; i < results.length; i++) {
      try {
        const socials = await enrichLeadSocials(results[i], igSession ?? undefined);
        Object.assign(results[i], socials);
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") {
          logger.warn(`[Instagram] Session expired during job ${job.id}, marking for reconnect`);
          await markSessionExpired(job.companyId).catch(() => {});
          igSession = null; // stop using Puppeteer, fall back to axios for remaining leads
        }
        // ponytail: all other errors are swallowed — social enrichment is best-effort
      }

      if ((i + 1) % 5 === 0 || i === results.length - 1) {
        const p = 90 + Math.round(((i + 1) / results.length) * 10);
        await job.update({ results: [...results], progress: p });
      }
    }
  } finally {
    await igSession?.close();
  }
}

export const createScraperJob = async (
  companyId: number,
  // "conselho" é fonte futura — aceita no contrato, sem branch de execução ainda
  source: "google_maps" | "cnpj" | "cnpj_search" | "ig_followers" | "conselho",
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
      const { keyword = "", city = "", state = "", maxResults = 50, lat, lng, radiusKm } = job.filters;
      const cityQuery = state ? `${city} ${state}` : city;
      // Busca por área no mapa tem precedência sobre cidade/UF
      const geo = typeof lat === "number" && typeof lng === "number"
        ? { lat, lng, radiusKm: radiusKm || 5 }
        : undefined;

      // Sidecar gosom/google-maps-scraper quando GMAPS_SCRAPER_URL está configurado
      // e o serviço responde; senão cai para o scraper Puppeteer local.
      const useSidecar = await isSidecarAvailable();
      logger.info(`[LeadScraperJob] jobId=${job.id} google_maps via ${useSidecar ? "sidecar" : "puppeteer"}${geo ? ` geo(${lat},${lng},${geo.radiusKm}km)` : ""}`);

      const onProgress = async (current: number, total: number) => {
        await job.update({ progress: Math.round((current / total) * 90) });
      };
      const results = useSidecar
        ? await scrapeViaSidecar(keyword, cityQuery, Math.min(maxResults, 200), onProgress, geo)
        : await scrapeGoogleMaps(keyword, cityQuery, Math.min(maxResults, 200), onProgress, { state, geo });

      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "cnpj") {
      const cnpjs = job.filters.cnpjs || [];
      const results: ScraperResult[] = [];

      for (let i = 0; i < cnpjs.length; i++) {
        const enriched = await enrichCnpj(cnpjs[i]);
        if (enriched) results.push(enriched);
        await job.update({ progress: Math.round(((i + 1) / cnpjs.length) * 85) });
        await delay(350); // BrasilAPI: safe at ~3 req/sec
      }

      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "cnpj_search") {
      const results = await searchCnpjsByFilters(
        job.filters,
        async (current, total) => {
          await job.update({ progress: Math.round((current / total) * 85) });
        }
      );
      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "ig_followers") {
      const { igTargetHandle = "", maxResults = 500 } = job.filters;

      let results: ScraperResult[];
      if (isApifyConfigured()) {
        // Provider externo: não usa a sessão Instagram do cliente (sem risco de ban)
        results = await scrapeFollowersViaApify(
          igTargetHandle,
          maxResults,
          async (current, total) => {
            await job.update({ progress: Math.round((current / total) * 85) });
          }
        );
      } else {
        const cookies = await getSessionCookies(job.companyId);
        if (!cookies) throw new Error("Conta Instagram não configurada. Conecte uma conta em Captador de Leads → 📸 Conectar Instagram.");

        results = await scrapeFollowers(
          igTargetHandle,
          cookies,
          maxResults,
          async (current, total) => {
            await job.update({ progress: Math.round((current / total) * 85) });
          }
        );
      }
      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });

    } else if (job.source === "conselho") {
      const results = await scrapeConselho(
        job.filters,
        async (current, total) => {
          await job.update({ progress: Math.round((current / total) * 85) });
        }
      );
      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });

    } else {
      await job.update({ status: "error", errorMessage: "source desconhecido" });
    }
  } catch (err: any) {
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
