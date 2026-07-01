import LeadScraperJob, { ScraperFilters } from "../../models/LeadScraperJob";
import { scrapeGoogleMaps } from "./GoogleMapsScraperService";
import { enrichCnpj } from "./CnpjEnricherService";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const createScraperJob = async (
  companyId: number,
  source: "google_maps" | "cnpj",
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

      await job.update({ status: "done", results, totalFound: results.length, progress: 100 });

    } else if (job.source === "cnpj") {
      const cnpjs = job.filters.cnpjs || [];
      const results = [];

      for (let i = 0; i < cnpjs.length; i++) {
        const enriched = await enrichCnpj(cnpjs[i]);
        if (enriched) results.push(enriched);
        await job.update({ progress: Math.round(((i + 1) / cnpjs.length) * 100) });
        await delay(350); // BrasilAPI: safe at ~3 req/sec
      }

      await job.update({ status: "done", results, totalFound: results.length, progress: 100 });
    }
  } catch (err: any) {
    logger.error(`[LeadScraperJob] jobId=${jobId} error: ${err.message}`);
    await job.update({ status: "error", errorMessage: err.message, progress: 0 });
  }
};
