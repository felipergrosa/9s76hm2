import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import { APIFY_TOKEN_ENV } from "../Instagram/InstagramApifyProvider";
import { getCompanyApifyToken } from "./ApifyTokenService";
import logger from "../../utils/logger";

// Motor de busca alternativo para Google Maps via Apify (compass~crawler-google-places-api).
// Mais estável/escalável que Puppeteer local e não depende de sidecar externo.
// Schema (GET /v2/acts/compass~crawler-google-places-api/builds/default -> inputSchema):
//   input  { searchStringsArray: string[], locationQuery?: string, maxCrawledPlacesPerSearch: int,
//             language: string, ...(geo: { lat, lng, radiusKm } via "customGeolocation") }
//   output { title, phone/phoneUnformatted, website, address, totalScore, categoryName, url }

const APIFY_BASE_URL = "https://api.apify.com/v2";
const GMAPS_ACTOR_ID = "compass~crawler-google-places";

const POLL_INTERVAL_MS = 5_000;
const RUN_TIMEOUT_MS = 30 * 60 * 1_000; // 30 min

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Mesma precedência do InstagramApifyProvider: override por empresa (DB,
// criptografado) → fallback global process.env.APIFY_TOKEN.
const resolveApifyToken = async (companyId?: number): Promise<string | null> => {
  if (companyId) {
    const companyToken = await getCompanyApifyToken(companyId);
    if (companyToken) return companyToken;
  }
  return process.env[APIFY_TOKEN_ENV]?.trim() || null;
};

export const isGmapsApifyConfigured = async (companyId?: number): Promise<boolean> =>
  Boolean(await resolveApifyToken(companyId));

const apifyToken = async (companyId?: number): Promise<string> => {
  const token = await resolveApifyToken(companyId);
  if (!token) throw new Error("APIFY_TOKEN não configurado. Configure em Configurações → Lead Scraper ou defina APIFY_TOKEN no ambiente.");
  return token;
};

const apifyError = (err: any, context: string): Error => {
  const status = err?.response?.status;
  if (status === 401 || status === 403) {
    return new Error(`${context}: APIFY_TOKEN inválido ou sem permissão (HTTP ${status}).`);
  }
  if (status === 402) {
    return new Error(`${context}: créditos Apify insuficientes (HTTP 402).`);
  }
  // Apify devolve detalhe do input inválido em error.message
  const detail = err?.response?.data?.error?.message;
  if (detail) return new Error(`${context}: ${detail}`);
  return new Error(`${context}: ${err?.message || "erro desconhecido"}`);
};

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

const startActorRun = async (actorId: string, input: object, companyId?: number): Promise<ApifyRun> => {
  try {
    const { data } = await axios.post(
      `${APIFY_BASE_URL}/acts/${actorId}/runs`,
      input,
      { params: { token: await apifyToken(companyId) }, timeout: 15_000 }
    );
    return data.data as ApifyRun;
  } catch (err: any) {
    throw apifyError(err, `Falha ao iniciar actor ${actorId}`);
  }
};

const getDatasetItemCount = async (datasetId: string, companyId?: number): Promise<number> => {
  try {
    const { data } = await axios.get(`${APIFY_BASE_URL}/datasets/${datasetId}`, {
      params: { token: await apifyToken(companyId) },
      timeout: 10_000,
    });
    return data?.data?.itemCount ?? 0;
  } catch {
    return 0;
  }
};

const waitForRun = async (
  runId: string,
  datasetId: string,
  max: number,
  onProgress?: (current: number, total: number) => Promise<void>,
  companyId?: number
): Promise<ApifyRun> => {
  const startedAt = Date.now();
  for (;;) {
    let run: ApifyRun;
    try {
      const { data } = await axios.get(`${APIFY_BASE_URL}/actor-runs/${runId}`, {
        params: { token: await apifyToken(companyId) },
        timeout: 15_000,
      });
      run = data.data as ApifyRun;
    } catch (err: any) {
      throw apifyError(err, `Falha ao consultar run ${runId}`);
    }

    if (run.status === "SUCCEEDED") return run;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
      throw new Error(`Run Apify ${runId} terminou com status ${run.status}.`);
    }
    if (Date.now() - startedAt > RUN_TIMEOUT_MS) {
      throw new Error(`Timeout de 30min aguardando run Apify ${runId} (status: ${run.status}).`);
    }

    if (onProgress) {
      const count = await getDatasetItemCount(datasetId, companyId);
      await onProgress(Math.min(count, max), max);
    }

    await delay(POLL_INTERVAL_MS);
  }
};

// O actor devolve state por extenso ou sigla — normaliza para UF
const STATE_TO_UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
  ceara: "CE", "distrito federal": "DF", "espirito santo": "ES",
  goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR",
  pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO",
  roraima: "RR", "santa catarina": "SC", "sao paulo": "SP",
  sergipe: "SE", tocantins: "TO",
};

const toUf = (state: any): string => {
  const s = String(state || "").trim();
  if (!s) return "";
  if (/^[A-Z]{2}$/.test(s)) return s;
  const key = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return STATE_TO_UF[key] || s.slice(0, 2).toUpperCase();
};

const getDatasetItems = async (datasetId: string, companyId?: number): Promise<any[]> => {
  try {
    const { data } = await axios.get(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
      params: { token: await apifyToken(companyId), format: "json" },
      timeout: 30_000,
    });
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    throw apifyError(err, `Falha ao ler dataset ${datasetId}`);
  }
};

export const scrapeGoogleMapsViaApify = async (
  keyword: string | string[],
  cityQuery: string,
  maxResults = 50,
  onProgress?: (current: number, total: number) => Promise<void>,
  opts?: { state?: string; geo?: { lat: number; lng: number; radiusKm: number }; companyId?: number }
): Promise<ScraperResult[]> => {
  const geo = opts?.geo;
  const companyId = opts?.companyId;
  // aceita várias queries num único run (searchStringsArray nativo) — o cap
  // é por query, então divide o total para não estourar custo/limites
  const queries = (Array.isArray(keyword) ? keyword : [keyword])
    .map(q => String(q).trim()).filter(Boolean).slice(0, 20);
  const input: Record<string, any> = {
    searchStringsArray: queries,
    maxCrawledPlacesPerSearch: Math.min(Math.ceil(maxResults / Math.max(queries.length, 1)), 200),
    language: "pt-BR",
    // extrai email/telefone/socials (IG/X/LinkedIn/Facebook) da página de contato
    // do site do lugar — scrapeSocialMediaProfiles é add-on pago por perfil,
    // scrapeContacts já cobre os links sociais
    scrapeContacts: true,
  };

  if (geo) {
    input.customGeolocation = {
      type: "Point",
      coordinates: [geo.lng, geo.lat],
    };
    input.locationQuery = undefined;
  } else {
    input.locationQuery = cityQuery;
  }

  const run = await startActorRun(GMAPS_ACTOR_ID, input, companyId);
  logger.info(`[GmapsApify] run ${run.id} iniciado para "${queries.join(" | ")}" ${geo ? `geo(${geo.lat},${geo.lng})` : cityQuery}`);

  const done = await waitForRun(run.id, run.defaultDatasetId, maxResults, onProgress, companyId);
  const items = await getDatasetItems(done.defaultDatasetId, companyId);

  const results: ScraperResult[] = [];
  for (const item of items) {
    if (results.length >= maxResults) break;
    const name = item.title || item.name;
    if (!name) continue;

    const address = [item.address, item.city, item.state].filter(Boolean).join(", ") || item.address || "";

    // scrapeContacts: emails/phones extraídos do site do lugar (array)
    const siteEmail = Array.isArray(item.emails) ? item.emails[0] : "";
    const sitePhone = Array.isArray(item.phones) ? item.phones[0] : "";
    // scrapeSocialMediaProfiles: perfis sociais extraídos do site/Google.
    // O actor pode devolver URL completa ou handle — normaliza para handle/slug.
    const soc = item.socials || {};
    const first = (v: any) => (Array.isArray(v) ? v[0] : null);
    const toHandle = (v: any) => {
      const s = String(v || "").trim();
      if (!s) return "";
      const m = s.match(/(?:instagram|twitter|x|facebook|linkedin)\.com\/(?:company\/|in\/)?([a-zA-Z0-9._%@-]{2,80})/i);
      return m ? m[1].replace(/[?/].*$/, "") : s.replace(/^@/, "");
    };

    results.push({
      name,
      phone: item.phone || item.phoneUnformatted || sitePhone || "",
      website: item.website || "",
      email: siteEmail || "",
      ...(first(soc.instagrams) ? { instagram: toHandle(first(soc.instagrams)) } : {}),
      ...(first(soc.twitters) ? { twitter: toHandle(first(soc.twitters)) } : {}),
      ...(first(soc.linkedins) ? { linkedin: toHandle(first(soc.linkedins)) } : {}),
      ...(first(soc.facebooks) ? { facebook: toHandle(first(soc.facebooks)) } : {}),
      address,
      municipio: item.city || "",
      uf: toUf(item.state),
      rating: item.totalScore ? String(item.totalScore) : "",
      category: item.categoryName || (Array.isArray(item.categories) ? item.categories[0] : "") || "",
      googleMapsUrl: item.url || "",
    } as ScraperResult);
  }

  await onProgress?.(results.length, maxResults);
  logger.info(`[GmapsApify] run ${run.id}: ${results.length} resultados mapeados`);
  return results;
};
