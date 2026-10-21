import axios from "axios";
import { ScraperResult, ScraperFilters } from "../../models/LeadScraperJob";
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

// placeMinimumStars do actor aceita só faixas fixas — mapeia minRating (0-5)
// para a faixa imediatamente abaixo (nunca filtra mais do que o pedido)
const toPlaceMinimumStars = (min: number): string | undefined => {
  if (min >= 5) return "five";
  if (min >= 4.75) return "fourAndThreeQuarters";
  if (min >= 4.5) return "fourAndHalf";
  if (min >= 4) return "four";
  if (min >= 3.5) return "threeAndHalf";
  if (min >= 3) return "three";
  if (min >= 2.5) return "twoAndHalf";
  if (min >= 2) return "two";
  return undefined;
};

// O actor ignora raio em Point — convertemos radiusKm num polígono circular
// (GeoJSON, [lng, lat]) de 24 vértices, então a busca por área respeita o raio
// de verdade em vez de expandir pelo viewport do Google.
const circlePolygon = (lat: number, lng: number, radiusKm: number, vertices = 24) => {
  const ring: [number, number][] = [];
  const latDeg = radiusKm / 111.32;
  const lngDeg = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  for (let i = 0; i <= vertices; i++) {
    const a = (2 * Math.PI * i) / vertices;
    ring.push([
      +(lng + lngDeg * Math.cos(a)).toFixed(6),
      +(lat + latDeg * Math.sin(a)).toFixed(6),
    ]);
  }
  return { type: "Polygon", coordinates: [ring] };
};

// Deptos válidos do enum leadsEnrichmentDepartments do actor
const VALID_LEAD_DEPARTMENTS = new Set([
  "c_suite", "product", "engineering_technical", "design", "education",
  "finance", "human_resources", "information_technology", "legal",
  "marketing", "medical_health", "operations", "sales", "consulting",
]);

export const scrapeGoogleMapsViaApify = async (
  keyword: string | string[],
  cityQuery: string,
  maxResults = 50,
  onProgress?: (current: number, total: number) => Promise<void>,
  opts?: { state?: string; geo?: { lat: number; lng: number; radiusKm: number }; companyId?: number; filters?: ScraperFilters }
): Promise<ScraperResult[]> => {
  const geo = opts?.geo;
  const companyId = opts?.companyId;
  const filters = opts?.filters;
  // aceita várias queries num único run (searchStringsArray nativo) — o cap
  // é por query, então divide o total para não estourar custo/limites
  const queries = (Array.isArray(keyword) ? keyword : [keyword])
    .map(q => String(q).trim()).filter(Boolean).slice(0, 20);
  const input: Record<string, any> = {
    searchStringsArray: queries,
    maxCrawledPlacesPerSearch: Math.min(Math.ceil(maxResults / Math.max(queries.length, 1)), 200),
    language: "pt-BR",
    // impede a expansão semântica/geográfica do Google: sem "only_includes" o
    // Maps retorna resultados correlatos fora do nicho ("engenharia civil"
    // numa busca de "projeto luminotécnico" numa UF inteira)
    searchMatching: filters?.exactMatch ? "only_exact" : "only_includes",
    // trava os resultados no Brasil — sem isso o Google pode expandir para
    // países de língua portuguesa ou cidades homônimas fora do BR
    countryCode: filters?.countryCode || "BR",
    // extrai email/telefone/socials (IG/X/LinkedIn/Facebook) da página de contato
    // do site do lugar — scrapeSocialMediaProfiles é add-on pago por perfil,
    // scrapeContacts já cobre os links sociais
    scrapeContacts: true,
  };

  // whitelist de categorias do Maps (categoryFilterWords): taxa única por
  // campo, restritiva — só entram places cuja categoria esteja na lista.
  // Categorias são strings do enum do actor (5.630 valores) — passamos cru;
  // o actor valida.
  const includeCats = (Array.isArray(filters?.includeCategories)
    ? filters.includeCategories
    : filters?.includeCategories ? [filters.includeCategories] : [])
    .map(s => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 100);
  if (includeCats.length) input.categoryFilterWords = includeCats;

  // varrer tudo do mapa: ignora os search terms e extrai todos os pins da
  // área — útil p/ mapear um polígono sem depender de termos de busca
  if (filters?.allPlacesMode) {
    input.allPlacesNoSearchAction = "all_places_no_search_ocr";
    delete input.searchStringsArray;
    delete input.maxCrawledPlacesPerSearch;
    if (maxResults) input.maxCrawledPlacesPerSearch = Math.min(maxResults, 300);
  }

  // Add-on de detalhes ($0.002/place flat): detail page abre horários,
  // popularTimes, peopleAlsoSearch, reviewsTags; scrapeDirectories varre
  // estabelecimentos dentro de shoppings/galerias; includeWebResults traz a
  // seção "Web results" (só aparece para usuários logados — melhor esforço)
  if (filters?.scrapeDetails) {
    input.scrapePlaceDetailPage = true;
    input.scrapeDirectories = true;
    input.includeWebResults = true;
  }

  // Add-on de decisores ($0.005/lead): extrai pessoas-chave do site da empresa
  // (nome, cargo, email, telefone, LinkedIn) — leadsEnrichmentDepartments
  // restringe por departamento (enum do actor)
  if (filters?.enrichLeads) {
    input.maximumLeadsEnrichmentRecords = Math.min(
      Math.max(Math.trunc(filters.leadsMaxPerPlace || 3), 1), 10
    );
    const deps = (Array.isArray(filters.leadsDepartments)
      ? filters.leadsDepartments
      : filters.leadsDepartments ? [filters.leadsDepartments] : [])
      .map(d => String(d).trim()).filter(d => VALID_LEAD_DEPARTMENTS.has(d));
    if (deps.length) input.leadsEnrichmentDepartments = deps;
    // enriquecimento só roda em places com website — o filtro "com site"
    // do actor já garante isso sem custo extra de crawl
  }

  // Add-on de perfis sociais enriquecidos (seguidores, bio, verified) — caro
  // por perfil ($0.10 no free tier); opt-in explícito
  if (filters?.enrichSocialProfiles) {
    input.instagrams = true;
    input.facebooks = true;
    input.linkedins = true;
    input.twitters = true;
    input.youtubes = true;
    input.tiktoks = true;
  }

  // skipClosedPlaces já vem ligado por padrão no actor — reforçamos no input e
  // só desligamos via opt-out explícito (filters.skipClosedPlaces === false).
  // O corte local abaixo no loop é redundância barata contra dataset antigo.
  const skipClosed = filters?.skipClosedPlaces !== false;
  if (skipClosed) input.skipClosedPlaces = true;

  const minStars = typeof filters?.minRating === "number" ? toPlaceMinimumStars(filters.minRating) : undefined;
  if (minStars) input.placeMinimumStars = minStars;

  // filtro de website no próprio actor economiza crawl/dataset
  if (filters?.onlyWithWebsite) input.website = "withWebsiteOnly";
  else if (filters?.onlyWithoutWebsite) input.website = "withoutWebsiteOnly";

  if (geo) {
    // radiusKm vira polígono circular — Point não respeita raio no actor
    input.customGeolocation = circlePolygon(geo.lat, geo.lng, geo.radiusKm || 5);
    input.locationQuery = undefined;
  } else {
    input.locationQuery = cityQuery;
  }

  const run = await startActorRun(GMAPS_ACTOR_ID, input, companyId);
  logger.info(`[GmapsApify] run ${run.id} iniciado para "${queries.join(" | ")}" ${geo ? `geo(${geo.lat},${geo.lng})` : cityQuery}`);

  const done = await waitForRun(run.id, run.defaultDatasetId, maxResults, onProgress, companyId);
  const items = await getDatasetItems(done.defaultDatasetId, companyId);

  // defesa local além do pós-filtro global: title/categoryName casando algum
  // excludeKeyword é cortado aqui (normKey local — mesma regra do QualityFilters)
  const normKey = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const excludeTerms = (Array.isArray(filters?.excludeKeywords)
    ? filters.excludeKeywords
    : filters?.excludeKeywords ? [filters.excludeKeywords] : [])
    .map(s => normKey(String(s))).filter(Boolean);

  // blacklist de categorias local (grátis — roda sobre os categories[] do
  // item, não só o categoryName primário)
  const excludeCats = (Array.isArray(filters?.excludeCategories)
    ? filters.excludeCategories
    : filters?.excludeCategories ? [filters.excludeCategories] : [])
    .map(s => normKey(String(s))).filter(Boolean);
  const catsMatch = (item: any): boolean => {
    if (!excludeCats.length) return false;
    const cats = [
      item.categoryName,
      ...(Array.isArray(item.categories) ? item.categories : []),
    ].map(c => normKey(String(c || "")));
    return cats.some(c => c && excludeCats.some(x => c.includes(x) || x.includes(c)));
  };

  const results: ScraperResult[] = [];
  for (const item of items) {
    if (results.length >= maxResults) break;
    const name = item.title || item.name;
    if (!name) continue;
    // anúncios promovidos são ruído puro pra geração de lead — sempre corta
    if (item.isAdvertisement === true) continue;
    // defesa local: mesmo com skipClosedPlaces no input, garante o corte
    // (temporarilyClosed entra no mesmo espírito — negócio não está operando)
    if (skipClosed && (item.permanentlyClosed === true || item.temporarilyClosed === true)) continue;
    if (excludeTerms.length) {
      const hay = `${normKey(String(item.title || ""))}|${normKey(String(item.categoryName || ""))}`;
      if (excludeTerms.some(t => hay.includes(t))) continue;
    }
    if (catsMatch(item)) continue;

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

    // detail page: openingHours vem como array de {day, hours} — vira resumo
    const hours = Array.isArray(item.openingHours)
      ? item.openingHours
          .map((d: any) => `${d.day || ""}: ${d.hours || ""}`.trim())
          .filter((s: string) => s.length > 2)
          .join(" | ")
      : "";
    const popular = Boolean(
      item.popularTimesHistogram && Object.keys(item.popularTimesHistogram || {}).length
    ) || Boolean(item.popularTimesLiveText);
    const img = Array.isArray(item.imageUrls) ? item.imageUrls[0] : "";
    const tags = Array.isArray(item.reviewsTags)
      ? item.reviewsTags.map((t: any) => t?.title || t).filter(Boolean).slice(0, 10)
      : undefined;

    // leads enrichment (add-on): decisores vêm em scrapedLeads — tolera
    // variações de nome do campo entre versões do actor
    const rawLeads = item.scrapedLeads || item.leads || item.businessLeads;
    const decisionMakers = Array.isArray(rawLeads)
      ? rawLeads.slice(0, 10).map((l: any) => ({
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || undefined,
          jobTitle: l.jobTitle || l.title || undefined,
          email: l.email || l.workEmail || undefined,
          phone: l.phone || l.phoneNumber || undefined,
          linkedin: l.linkedin || l.linkedinUrl || undefined,
          department: l.department || undefined,
        })).filter((d: any) => d.name || d.email || d.jobTitle)
      : undefined;

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
      ...(typeof item.reviewsCount === "number" ? { reviewsCount: item.reviewsCount } : {}),
      category: item.categoryName || (Array.isArray(item.categories) ? item.categories[0] : "") || "",
      googleMapsUrl: item.url || "",
      // campos extras do actor — dedupe, geo e sinais de negócio ativo
      ...(item.placeId ? { placeId: item.placeId } : {}),
      ...(Array.isArray(item.categories) && item.categories.length ? { categories: item.categories.slice(0, 10) } : {}),
      ...(item.postalCode || item.cep ? { cep: item.postalCode || item.cep } : {}),
      ...(item.location?.lat && item.location?.lng ? { lat: item.location.lat, lng: item.location.lng } : {}),
      ...(item.temporarilyClosed === true ? { temporarilyClosed: true } : {}),
      ...(hours ? { openingHours: hours } : {}),
      ...(popular ? { hasPopularTimes: true } : {}),
      ...(img ? { imageUrl: img } : {}),
      ...(tags?.length ? { reviewsTags: tags } : {}),
      ...(decisionMakers?.length ? { decisionMakers } : {}),
    } as ScraperResult);
  }

  await onProgress?.(results.length, maxResults);
  logger.info(`[GmapsApify] run ${run.id}: ${results.length} resultados mapeados`);
  return results;
};
