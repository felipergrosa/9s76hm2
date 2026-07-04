import LeadScraperJob, { ScraperFilters, ScraperResult } from "../../models/LeadScraperJob";
import { scrapeGoogleMaps } from "./GoogleMapsScraperService";
import { enrichCnpj } from "./CnpjEnricherService";
import { searchCnpjsByFilters } from "./CnpjSearchService";
import { enrichLeadSocials } from "./SocialEnricherService";
import { getSessionCookies, markSessionExpired } from "../Instagram/InstagramAuthService";
import { InstagramBrowserSession } from "../Instagram/InstagramProfileService";
import { scrapeFollowers } from "../Instagram/InstagramFollowersService";
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
  source: "google_maps" | "cnpj" | "cnpj_search",
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
  const job = await LeadScraperJob.findByPk(jobId);
  if (!job) return;

  await job.update({ status: "running", progress: 0 });

  try {
    if (job.source === "google_maps") {
      const { keyword = "", city = "", state = "", maxResults = 50 } = job.filters;
      const cityQuery = state ? `${city} ${state}` : city;

      const results = await scrapeGoogleMaps(
        keyword,
        cityQuery,
        Math.min(maxResults, 200),
        async (current, total) => {
          await job.update({ progress: Math.round((current / total) * 90) });
        }
      );

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
      const cookies = await getSessionCookies(job.companyId);
      if (!cookies) throw new Error("Conta Instagram não configurada. Conecte uma conta em Captador de Leads → 📸 Conectar Instagram.");

      const results = await scrapeFollowers(
        igTargetHandle,
        cookies,
        maxResults,
        async (current, total) => {
          await job.update({ progress: Math.round((current / total) * 85) });
        }
      );
      await job.update({ results, totalFound: results.length, progress: 90 });
      await runSocialEnrichment(job, results);
      await job.update({ status: "done", progress: 100 });
    }
  } catch (err: any) {
    logger.error(`[LeadScraperJob] jobId=${jobId} error: ${err.message}`);
    await job.update({ status: "error", errorMessage: err.message, progress: 0 });
  }
};
