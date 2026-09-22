import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
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

export const isApifyConfigured = (): boolean =>
  Boolean(process.env[APIFY_TOKEN_ENV]?.trim());

const apifyToken = (): string => {
  const token = process.env[APIFY_TOKEN_ENV]?.trim();
  if (!token) {
    throw new Error("APIFY_TOKEN não configurado no ambiente.");
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
const startActorRun = async (actorId: string, input: object): Promise<ApifyRun> => {
  try {
    const { data } = await axios.post(
      `${APIFY_BASE_URL}/acts/${actorId}/runs`,
      input,
      { params: { token: apifyToken() }, timeout: 15_000 }
    );
    return data.data as ApifyRun;
  } catch (err: any) {
    throw apifyError(err, `Falha ao iniciar actor ${actorId}`);
  }
};

// GET /datasets/{id} — usado só para reportar progresso (itemCount parcial)
const getDatasetItemCount = async (datasetId: string): Promise<number> => {
  try {
    const { data } = await axios.get(`${APIFY_BASE_URL}/datasets/${datasetId}`, {
      params: { token: apifyToken() },
      timeout: 10_000,
    });
    return data?.data?.itemCount ?? 0;
  } catch {
    return 0; // progresso é best-effort; não deve derrubar o job
  }
};

// Poll GET /actor-runs/{runId} até status terminal (5s, timeout 20min)
const waitForRun = async (
  runId: string,
  datasetId: string,
  max: number,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ApifyRun> => {
  const startedAt = Date.now();

  for (;;) {
    let run: ApifyRun;
    try {
      const { data } = await axios.get(`${APIFY_BASE_URL}/actor-runs/${runId}`, {
        params: { token: apifyToken() },
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
      const count = await getDatasetItemCount(datasetId);
      await onProgress(Math.min(count, max), max);
    }

    await delay(POLL_INTERVAL_MS);
  }
};

// GET /datasets/{datasetId}/items?format=json
const getDatasetItems = async (datasetId: string): Promise<any[]> => {
  try {
    const { data } = await axios.get(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
      params: { token: apifyToken(), format: "json" },
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
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const username = handle.replace(/^@/, "").trim();
  if (!username) throw new Error("Handle do Instagram inválido.");

  const max = Math.min(Math.max(1, maxResults || 500), MAX_HARD_LIMIT);

  const run = await startActorRun(FOLLOWERS_ACTOR_ID, {
    usernames: [username],
    dataToScrape: "followers",
    resultsLimit: max,
  });
  logger.info(`[Instagram/Apify] run ${run.id} iniciado para @${username} (limit=${max})`);

  const done = await waitForRun(run.id, run.defaultDatasetId, max, onProgress);
  const items = await getDatasetItems(done.defaultDatasetId);

  const results: ScraperResult[] = [];
  const errorDescriptions: string[] = [];

  for (const item of items) {
    // Actor empurra um item de erro quando o perfil é privado/inexistente
    if (item?.error) {
      errorDescriptions.push(item.errorDescription || String(item.error));
      continue;
    }
    // Garante que só entram seguidores (actor também suporta "following")
    if (item?.type && item.type !== "FOLLOWER") continue;
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
  handle: string
): Promise<Partial<ScraperResult> | null> => {
  const username = handle.replace(/^@/, "").trim();
  if (!username) return null;

  const run = await startActorRun(PROFILE_ACTOR_ID, { usernames: [username] });
  const done = await waitForRun(run.id, run.defaultDatasetId, 1);
  const items = await getDatasetItems(done.defaultDatasetId);

  const profile = items.find(i => i && !i.error && (i.username || i.fullName));
  if (!profile) {
    logger.warn(`[Instagram/Apify] enrich: perfil @${username} sem dados (${items[0]?.errorDescription || "vazio"})`);
    return null;
  }

  const isPrivate = profile.private ?? profile.isPrivate ?? profile.is_private;
  const isVerified = profile.verified ?? profile.isVerified ?? profile.is_verified;
  const email =
    profile.businessEmail || profile.publicEmail || profile.public_email ||
    profile.email || "";
  const phone =
    profile.businessPhoneNumber || profile.contactPhoneNumber ||
    profile.public_phone_number || profile.contact_phone_number ||
    profile.phone || "";

  return {
    name: profile.fullName || profile.full_name || profile.username || username,
    instagram: profile.username || username,
    website: profile.externalUrl || profile.external_url || "",
    category: profile.businessCategoryName || profile.categoryName || profile.category || "",
    situacao: isPrivate ? "privada" : "pública",
    porte: isVerified ? "verificada" : "",
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
};
