import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

/**
 * Sidecar opcional de scraping do Google Maps baseado em gosom/google-maps-scraper (Go, MIT).
 *
 * Variável de ambiente esperada:
 *   GMAPS_SCRAPER_URL — URL base da API REST do sidecar (ex.: http://gmaps-scraper:8080).
 *   Se não estiver definida, o sidecar é considerado indisponível e o fluxo
 *   deve cair para o scraper Puppeteer (GoogleMapsScraperService).
 *
 * API do sidecar (web mode, sem auth):
 *   POST /api/v1/jobs              -> cria job { id }
 *   GET  /api/v1/jobs/{id}         -> status pending|working|ok|failed
 *   GET  /api/v1/jobs/{id}/download-> CSV com os resultados
 */
export const GMAPS_SIDECAR_ENV = "GMAPS_SCRAPER_URL";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const POLL_INTERVAL_MS = 5000;
const JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

// Resultado estendido: ScraperResult ainda não declara googleMapsUrl no model
// (LeadScraperJob.ts). Mantido aqui até o campo ser adicionado ao model.
type SidecarResult = ScraperResult & { googleMapsUrl?: string };

const getBaseUrl = (): string =>
  (process.env[GMAPS_SIDECAR_ENV] || "").replace(/\/+$/, "");

/**
 * Verifica se o sidecar está configurado e respondendo (timeout de 3s).
 */
export const isSidecarAvailable = async (): Promise<boolean> => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return false;

  try {
    await axios.get(`${baseUrl}/api/v1/jobs`, { timeout: 3000 });
    return true;
  } catch (err: any) {
    logger.warn(`[GmapsSidecar] indisponível em ${baseUrl}: ${err.message}`);
    return false;
  }
};

/**
 * Parser CSV simples e robusto: suporta campos entre aspas, vírgulas e
 * quebras de linha internas, aspas escapadas ("") e BOM.
 */
function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows
    .filter(r => r.some(c => c !== ""))
    .map(r => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

// Primeira chave não-vazia vence (o CSV tem ~34 colunas e os nomes variam entre versões)
const pick = (row: Record<string, string>, ...keys: string[]): string => {
  for (const k of keys) {
    if (row[k]) return row[k];
  }
  return "";
};

const extractJobStatus = (data: any): string =>
  String(data?.status ?? data?.Status ?? data?.data?.status ?? "").toLowerCase();

/**
 * Executa o scraping via sidecar:
 * 1) cria o job com a keyword "keyword cidade",
 * 2) faz polling a cada 5s até ok/failed (timeout total de 30min),
 * 3) baixa o CSV e mapeia para ScraperResult.
 */
export const scrapeViaSidecar = async (
  keyword: string,
  cityQuery: string,
  maxResults = 50,
  onProgress?: (current: number, total: number) => Promise<void>,
  geo?: { lat: number; lng: number; radiusKm: number }
): Promise<ScraperResult[]> => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error(`${GMAPS_SIDECAR_ENV} não configurada`);
  }

  // depth ~ profundidade de scroll por keyword; max_time em segundos
  const depth = Math.ceil(maxResults / 10) + 2;
  const maxTime = Math.max(300, maxResults * 6);
  // Em geo mode a keyword vai sozinha — lat/lon/radius definem a área
  const query = geo ? keyword.trim() : `${keyword} ${cityQuery}`.trim();

  const { data: created } = await axios.post(
    `${baseUrl}/api/v1/jobs`,
    {
      name: `lead-scraper-${Date.now()}`,
      keywords: [query],
      lang: "pt-BR",
      zoom: geo ? (geo.radiusKm <= 5 ? 15 : geo.radiusKm <= 15 ? 14 : 13) : 15,
      depth,
      email: true,
      fast_mode: false,
      max_time: maxTime,
      proxies: [],
      // Área geográfica escolhida no mapa (raio em metros, conforme API do sidecar)
      ...(geo ? { lat: geo.lat, lon: geo.lng, radius: Math.round(geo.radiusKm * 1000) } : {})
    },
    { timeout: 15000 }
  );

  const jobId: string = String(created?.id ?? created?.ID ?? created);
  if (!jobId || jobId === "[object Object]") {
    throw new Error(`Sidecar retornou job sem id válido: ${JSON.stringify(created)}`);
  }
  logger.info(`[GmapsSidecar] job ${jobId} criado para "${query}" (depth=${depth}, max_time=${maxTime}s)`);
  await onProgress?.(0, maxResults);

  // Polling até ok/failed ou timeout
  const startedAt = Date.now();
  let status = "";
  let lastJobData: any = null;

  while (Date.now() - startedAt < JOB_TIMEOUT_MS) {
    await delay(POLL_INTERVAL_MS);
    try {
      const { data } = await axios.get(`${baseUrl}/api/v1/jobs/${jobId}`, { timeout: 10000 });
      lastJobData = data;
      status = extractJobStatus(data);
    } catch (err: any) {
      // Falha transitória de poll: loga e continua até o timeout total
      logger.warn(`[GmapsSidecar] poll job ${jobId} falhou: ${err.message}`);
      continue;
    }

    if (status === "ok" || status === "failed") break;
  }

  if (status === "failed") {
    const reason = lastJobData?.error || lastJobData?.Error || "motivo não informado";
    throw new Error(`Sidecar job ${jobId} falhou: ${reason}`);
  }
  if (status !== "ok") {
    throw new Error(`Sidecar job ${jobId} timeout após ${JOB_TIMEOUT_MS / 60000}min (último status: ${status || "desconhecido"})`);
  }

  // Download do CSV e mapeamento para ScraperResult
  const { data: csv } = await axios.get(`${baseUrl}/api/v1/jobs/${jobId}/download`, {
    timeout: 60000,
    responseType: "text",
    transformResponse: [(r: any) => r]
  });

  const rows = parseCsv(String(csv));
  logger.info(`[GmapsSidecar] job ${jobId} retornou ${rows.length} linhas`);

  const results: SidecarResult[] = [];
  for (const row of rows) {
    if (results.length >= maxResults) break;

    const name = pick(row, "title", "name");
    if (!name) continue;

    const result: SidecarResult = {
      name,
      phone: pick(row, "phone", "phones"),
      website: pick(row, "website", "site"),
      email: pick(row, "email", "emails"),
      category: pick(row, "category", "categories"),
      address: pick(row, "address", "complete_address"),
      rating: pick(row, "rating")
    };

    // Campo extra: link do perfil no Google Maps (coluna "link" no CSV do sidecar)
    const mapsUrl = pick(row, "link", "url", "google_maps_url", "googlemaps_url");
    if (mapsUrl) result.googleMapsUrl = mapsUrl;

    // latitude/longitude ignorados propositalmente (não usados no pipeline)
    results.push(result);
  }

  await onProgress?.(results.length, maxResults);
  logger.info(`[GmapsSidecar] "${query}" -> ${results.length} resultados mapeados`);
  return results;
};
