import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import { getCompanyApifyToken } from "../LeadScraper/ApifyTokenService";
import logger from "../../utils/logger";

// Provider alternativo para o source `ig_followers` via API da Apify.
// Motivação: hoje o scraping usa a sessão Instagram do próprio cliente
// (axios + cookies), com alto risco de ban. Com APIFY_TOKEN configurado,
// o orquestrador pode delegar o scraping à Apify (free tier ~US$ 5/mês de
// crédito ≈ 2-3k perfis; actor de followers é PAY_PER_EVENT ~US$ 0,002/resultado).
//
// Schema real verificado em GET /v2/acts/{actor}/builds/default → inputSchema:
// - apify~instagram-followers-following-scraper:
//     input  { usernames: string[] (obrigatório), dataToScrape: "followers"|"following",
//              resultsLimit: int >= 1 }
//     output { sourceUsername, userId, username, fullName, profilePicUrl,
//              isVerified, isPrivate, type: "FOLLOWER"|"FOLLOWING" }
//     erro   { error: "no_items", errorDescription: "Profile is private"|"Profile does not exist" }
// - apify~instagram-profile-scraper (enriquecimento de perfil):
//     input  { usernames: string[] (obrigatório) }
//     output { username, fullName, biography, externalUrl, followersCount,
//              businessCategoryName, private, verified, contato público se houver }

export const APIFY_TOKEN_ENV = "APIFY_TOKEN";

const APIFY_BASE_URL = "https://api.apify.com/v2";
// Na API v2 os actor ids usam `~` no lugar de `/`
const FOLLOWERS_ACTOR_ID = "apify~instagram-followers-following-scraper";
const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";

const POLL_INTERVAL_MS = 5_000;
const RUN_TIMEOUT_MS = 20 * 60 * 1_000; // 20 min
const MAX_HARD_LIMIT = 5000; // mesmo teto do provider de sessão

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Resolve o token: override por empresa (salvo criptografado via Configurações,
// tem precedência) → fallback global process.env.APIFY_TOKEN (self-hosted single-tenant).
const resolveApifyToken = async (companyId?: number): Promise<string | null> => {
  if (companyId) {
    const companyToken = await getCompanyApifyToken(companyId);
    if (companyToken) return companyToken;
  }
  return process.env[APIFY_TOKEN_ENV]?.trim() || null;
};

export const isApifyConfigured = async (companyId?: number): Promise<boolean> =>
  Boolean(await resolveApifyToken(companyId));

const apifyToken = async (companyId?: number): Promise<string> => {
  const token = await resolveApifyToken(companyId);
  if (!token) {
    throw new Error("APIFY_TOKEN não configurado. Configure em Configurações → Lead Scraper ou defina APIFY_TOKEN no ambiente.");
  }
  return token;
};

// Traduz erros HTTP da API para mensagens acionáveis
const apifyError = (err: any, context: string): Error => {
  const status = err?.response?.status;
  if (status === 401 || status === 403) {
    return new Error(`${context}: APIFY_TOKEN inválido ou sem permissão (HTTP ${status}).`);
  }
  if (status === 402) {
    return new Error(`${context}: créditos Apify insuficientes (HTTP 402).`);
  }
  return new Error(`${context}: ${err?.message || "erro desconhecido"}`);
};

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

// POST /acts/{actor}/runs?token= — inicia o run e devolve o runId
export const startActorRun = async (actorId: string, input: object, companyId?: number): Promise<ApifyRun> => {
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

// GET /datasets/{id} — usado só para reportar progresso (itemCount parcial)
export const getDatasetItemCount = async (datasetId: string, companyId?: number): Promise<number> => {
  try {
    const { data } = await axios.get(`${APIFY_BASE_URL}/datasets/${datasetId}`, {
      params: { token: await apifyToken(companyId) },
      timeout: 10_000,
    });
    return data?.data?.itemCount ?? 0;
  } catch {
    return 0; // progresso é best-effort; não deve derrubar o job
  }
};

// Poll GET /actor-runs/{runId} até status terminal (5s, timeout 20min)
export const waitForRun = async (
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
      throw new Error(`Timeout de 20min aguardando run Apify ${runId} (status: ${run.status}).`);
    }

    // Progresso real: itens já gravados no dataset do run
    if (onProgress) {
      const count = await getDatasetItemCount(datasetId, companyId);
      await onProgress(Math.min(count, max), max);
    }

    await delay(POLL_INTERVAL_MS);
  }
};

// GET /datasets/{datasetId}/items?format=json
export const getDatasetItems = async (datasetId: string, companyId?: number): Promise<any[]> => {
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

export const scrapeFollowersViaApify = async (
  handle: string,
  maxResults: number,
  onProgress?: (current: number, total: number) => Promise<void>,
  companyId?: number
): Promise<ScraperResult[]> => {
  const username = handle.replace(/^@/, "").trim();
  if (!username) throw new Error("Handle do Instagram inválido.");

  const max = Math.min(Math.max(1, maxResults || 500), MAX_HARD_LIMIT);

  const run = await startActorRun(FOLLOWERS_ACTOR_ID, {
    usernames: [username],
    dataToScrape: "followers",
    resultsLimit: max,
  }, companyId);
  logger.info(`[Instagram/Apify] run ${run.id} iniciado para @${username} (limit=${max})`);

  const done = await waitForRun(run.id, run.defaultDatasetId, max, onProgress, companyId);
  const items = await getDatasetItems(done.defaultDatasetId, companyId);

  const results: ScraperResult[] = [];
  const errorDescriptions: string[] = [];

  for (const item of items) {
    // Actor empurra um item de erro quando o perfil é privado/inexistente
    if (item?.error) {
      errorDescriptions.push(item.errorDescription || String(item.error));
      continue;
    }
    // Garante que só entram seguidores (actor também suporta "following")
    // — actor retorna "follower" lowercase apesar do readme indicar "FOLLOWER"
    if (item?.type && String(item.type).toUpperCase() !== "FOLLOWER") continue;
    if (!item?.username) continue;

    const isPrivate = item.isPrivate ?? item.is_private;
    const isVerified = item.isVerified ?? item.is_verified;
    const email = item.email || item.publicEmail || item.businessEmail || "";
    const phone = item.phone || item.publicPhoneNumber || item.businessPhoneNumber || "";

    results.push({
      name: item.fullName || item.full_name || item.username || "",
      instagram: item.username,
      website: item.external_url || item.externalUrl || "",
      category: item.category || "",
      situacao: isPrivate ? "privada" : "pública", // mesmo padrão do provider de sessão
      porte: isVerified ? "verificada" : "",
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
  }

  // Sem resultados + itens de erro → propaga a causa (perfil privado/inexistente)
  if (!results.length && errorDescriptions.length) {
    throw new Error(`Apify não retornou seguidores para @${username}: ${errorDescriptions[0]}`);
  }

  logger.info(`[Instagram/Apify] run ${run.id}: ${results.length} seguidores de @${username}`);
  return results;
};

// Enriquecimento de um único perfil via apify/instagram-profile-scraper.
// Retorna dados públicos do perfil (bio, site, categoria, contato se exposto).
export const enrichProfileViaApify = async (
  handle: string,
  companyId?: number
): Promise<Partial<ScraperResult> | null> => {
  const username = handle.replace(/^@/, "").trim();
  if (!username) return null;

  const run = await startActorRun(PROFILE_ACTOR_ID, { usernames: [username] }, companyId);
  const done = await waitForRun(run.id, run.defaultDatasetId, 1, undefined, companyId);
  const items = await getDatasetItems(done.defaultDatasetId, companyId);

  const profile = items.find(i => i && !i.error && (i.username || i.fullName));
  if (!profile) {
    logger.warn(`[Instagram/Apify] enrich: perfil @${username} sem dados (${items[0]?.errorDescription || "vazio"})`);
    return null;
  }

  return parseProfileItem(profile, username);
};

// Normaliza um item do dataset do profile-scraper para ScraperResult
const parseProfileItem = (item: any, fallbackUsername?: string): Partial<ScraperResult> => {
  const isPrivate = item.private ?? item.isPrivate ?? item.is_private;
  const isVerified = item.verified ?? item.isVerified ?? item.is_verified;
  const email =
    item.businessEmail || item.publicEmail || item.public_email ||
    item.email || "";
  const phone =
    item.businessPhoneNumber || item.contactPhoneNumber ||
    item.public_phone_number || item.contact_phone_number ||
    item.phone || "";

  return {
    name: item.fullName || item.full_name || item.username || fallbackUsername || "",
    instagram: item.username || fallbackUsername || "",
    website: item.externalUrl || item.external_url || "",
    category: item.businessCategoryName || item.categoryName || item.category || "",
    situacao: isPrivate ? "privada" : "pública",
    porte: isVerified ? "verificada" : "",
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
};

// Enriquecimento em lote: 1 run para N handles (vs N runs no modo por-perfil).
// Retorna mapa username(lowercase) → dados do perfil. Chunks de 100.
export const enrichProfilesBatchViaApify = async (
  handles: string[],
  companyId?: number,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<Map<string, Partial<ScraperResult>>> => {
  const CHUNK = 100;
  const clean = [...new Set(
    handles.map(h => String(h || "").replace(/^@/, "").trim().toLowerCase()).filter(Boolean)
  )];
  const out = new Map<string, Partial<ScraperResult>>();

  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK);
    const run = await startActorRun(PROFILE_ACTOR_ID, { usernames: chunk }, companyId);
    logger.info(`[Instagram/Apify] batch enrich run ${run.id}: ${chunk.length} perfis`);
    const done = await waitForRun(run.id, run.defaultDatasetId, chunk.length, onProgress, companyId);
    const items = await getDatasetItems(done.defaultDatasetId, companyId);
    for (const item of items) {
      if (!item || item.error) continue;
      const u = String(item.username || "").toLowerCase();
      if (!u) continue;
      out.set(u, parseProfileItem(item));
    }
  }
  return out;
};
