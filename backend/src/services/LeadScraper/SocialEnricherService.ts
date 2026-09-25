import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import {
  isApifyConfigured,
  enrichProfileViaApify,
  enrichProfilesBatchViaApify,
  startActorRun,
  waitForRun,
  getDatasetItems,
} from "../Instagram/InstagramApifyProvider";
import logger from "../../utils/logger";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const http = axios.create({
  timeout: 8000,
  headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
  maxRedirects: 5,
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Common platform path segments that are NOT user handles
const EXCLUDED = new Set([
  "p","reel","reels","stories","explore","tv","about","blog","help","legal","privacy",
  "press","accounts","login","signup","challenge","intent","share","hashtag","business",
  "ads","developer","company","careers","in","pub","dir","jobs","feed","home","news",
  "logout","register","create","verify","recover","reset","support","contact","terms",
  "policy","cookie","security","safety","transparency","sharedfiles","profiles","search",
]);

const PATTERNS = {
  instagram: /instagram\.com\/([a-zA-Z0-9._]{2,30})(?:[\/?"'`<\s\n]|$)/g,
  twitter:   /(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,15})(?:[\/?"'`<\s\n]|$)/g,
  linkedin:  /linkedin\.com\/(?:company|in)\/([a-zA-Z0-9%_-]{2,80})(?:[\/?"'`<\s\n]|$)/g,
  facebook:  /facebook\.com\/([a-zA-Z0-9.]{3,60})(?:[\/?"'`<\s\n]|$)/g,
};

function extractHandle(html: string, platform: keyof typeof PATTERNS): string | null {
  const re = new RegExp(PATTERNS[platform].source, "gi");
  for (const m of html.matchAll(re)) {
    const handle = decodeURIComponent(m[1]).toLowerCase();
    if (!EXCLUDED.has(handle) && !/^\d+$/.test(handle)) return handle;
  }
  return null;
}

// Extrai handle direto de uma URL (usado no batch Google — organicResults traz URLs prontas)
function handleFromUrl(url: string, platform: keyof typeof PATTERNS): string | null {
  return extractHandle(` ${url} `, platform);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await http.get(url);
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

async function fromWebsite(url: string): Promise<Partial<Record<"instagram" | "twitter" | "linkedin" | "facebook", string>>> {
  const base = url.startsWith("http") ? url : `https://${url}`;
  const html = await fetchHtml(base);
  if (!html) return {};
  return {
    instagram: extractHandle(html, "instagram") ?? undefined,
    twitter:   extractHandle(html, "twitter")   ?? undefined,
    linkedin:  extractHandle(html, "linkedin")  ?? undefined,
    facebook:  extractHandle(html, "facebook")  ?? undefined,
  };
}

async function fromDDG(query: string, platform: keyof typeof PATTERNS): Promise<string | null> {
  const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return null;
  return extractHandle(html, platform);
}

// BR phone: (DDD) 9XXXX-XXXX or +55 variants
const BR_PHONE = /(?:\+55[\s-]?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}[-\s]?\d{4}/;

async function instagramBioPhone(handle: string): Promise<string | null> {
  const html = await fetchHtml(`https://www.instagram.com/${handle}/`);
  if (!html) return null;
  // ponytail: reads meta description only; full bio needs Puppeteer+login for JS-rendered content
  const m = html.match(/(?:name|property)="description"\s+content="([^"]{0,500})"/i)
         ?? html.match(/content="([^"]{0,500})"\s+(?:name|property)="description"/i);
  if (!m) return null;
  const phone = m[1].match(BR_PHONE);
  return phone ? phone[0].replace(/[\s()-]/g, "") : null;
}

export const enrichLeadSocials = async (
  result: ScraperResult,
  companyId?: number
): Promise<Pick<ScraperResult, "instagram" | "twitter" | "linkedin" | "facebook" | "instagramPhone">> => {
  const out: Partial<ScraperResult> = {};

  // 1. Website extraction — fast, no extra browser, reuses website already scraped
  if (result.website) {
    Object.assign(out, await fromWebsite(result.website));
  }

  // 2. DuckDuckGo fallback for missing platforms
  const name = `"${(result.razaoSocial || result.nomeFantasia || result.name || "").slice(0, 60)}"`;
  const loc  = result.municipio || "";

  if (!out.instagram) {
    out.instagram = (await fromDDG(`site:instagram.com ${name} ${loc}`, "instagram")) ?? undefined;
    if (out.instagram) await delay(600);
  }
  if (!out.twitter) {
    out.twitter = (await fromDDG(`(site:x.com OR site:twitter.com) ${name}`, "twitter")) ?? undefined;
    if (out.twitter) await delay(600);
  }
  if (!out.linkedin) {
    out.linkedin = (await fromDDG(`site:linkedin.com/company ${name}`, "linkedin")) ?? undefined;
    if (out.linkedin) await delay(600);
  }
  if (!out.facebook) {
    out.facebook = (await fromDDG(`site:facebook.com ${name}`, "facebook")) ?? undefined;
    if (out.facebook) await delay(600);
  }

  // 3. Instagram bio → BR phone
  // Apify instagram-profile-scraper quando configurado (dados de negócio expostos
  // publicamente, sem sessão pessoal/risco de ban); fallback: parse do meta description via axios.
  if (out.instagram) {
    await delay(600);
    if (await isApifyConfigured(companyId)) {
      try {
        const profile = await enrichProfileViaApify(out.instagram as string, companyId);
        if (profile?.phone) {
          out.instagramPhone = profile.phone;
          if (!result.phone) (out as any).phone = profile.phone;
        }
        if (profile?.email && !out.email) (out as any).email = profile.email;
      } catch (err: any) {
        // best-effort: Apify indisponível não derruba o enriquecimento
      }
    } else {
      const phone = await instagramBioPhone(out.instagram as string);
      if (phone) {
        out.instagramPhone = phone;
        if (!result.phone) (out as any).phone = phone;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v != null && v !== "")
  ) as any;
};

// ── Enriquecimento em lote via Google Search (Apify) ─────────────────────────
// O DuckDuckGo HTML retorna 202 (anti-bot) em servidores — o actor oficial
// apify~google-search-scraper usa proxy residencial e cobre IG/X/LinkedIn/
// Facebook numa única query por lead. O actor aceita N queries por run
// (chunks de 50) — muito mais barato e confiável que N buscas DDG.
const GOOGLE_SEARCH_ACTOR = "apify~google-search-scraper";
const SOCIAL_PLATFORMS = ["instagram", "twitter", "linkedin", "facebook"] as const;

// Passo 1 (grátis): website do lead → links sociais no HTML. Paralelo com pool.
export const enrichFromWebsitesBatch = async (
  results: ScraperResult[],
  onItem?: (done: number, total: number) => Promise<void>
): Promise<void> => {
  const targets = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.website && (!r.instagram || !r.twitter || !r.linkedin || !r.facebook));
  const POOL = 10;
  let done = 0;
  for (let i = 0; i < targets.length; i += POOL) {
    await Promise.all(targets.slice(i, i + POOL).map(async ({ r }) => {
      const found = await fromWebsite(r.website!);
      if (found.instagram && !r.instagram) r.instagram = found.instagram;
      if (found.twitter && !r.twitter) r.twitter = found.twitter;
      if (found.linkedin && !r.linkedin) r.linkedin = found.linkedin;
      if (found.facebook && !r.facebook) r.facebook = found.facebook;
      done++;
    }));
    await onItem?.(done, targets.length);
  }
};

// Passo 2 (Apify): Google Search em batch para leads ainda sem nenhuma rede.
// Query: "nome" cidade uf (site:instagram.com OR site:linkedin.com OR site:x.com OR site:facebook.com)
export const enrichSocialsBatchViaApify = async (
  results: ScraperResult[],
  companyId?: number,
  onProgress?: (cur: number, total: number) => Promise<void>
): Promise<number> => {
  if (!(await isApifyConfigured(companyId))) return 0;

  const targets = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.instagram && !r.twitter && !r.linkedin && !r.facebook
      && (r.razaoSocial || r.nomeFantasia || r.name));
  if (!targets.length) return 0;

  // índice da query → lead (queries idênticas de leads distintos são dedupadas)
  const queryToIdx = new Map<string, number[]>();
  const queries: string[] = [];
  for (const { r, i } of targets) {
    const nome = (r.razaoSocial || r.nomeFantasia || r.name || "").slice(0, 60).replace(/"/g, "");
    const loc = [r.municipio, r.uf].filter(Boolean).join(" ");
    const q = `"${nome}" ${loc} (site:instagram.com OR site:linkedin.com OR site:x.com OR site:facebook.com)`.replace(/\s+/g, " ").trim();
    if (!queryToIdx.has(q)) queryToIdx.set(q, []);
    queryToIdx.get(q)!.push(i);
    if (!queries.includes(q)) queries.push(q);
  }

  let enriched = 0;
  const CHUNK = 50;
  for (let i = 0; i < queries.length; i += CHUNK) {
    const chunk = queries.slice(i, i + CHUNK);
    try {
      const run = await startActorRun(GOOGLE_SEARCH_ACTOR, {
        queries: chunk.join("\n"),
        maxPagesPerQuery: 1,
        resultsPerPage: 5,
        countryCode: "br",
        languageCode: "pt-BR",
        mobileResults: false,
      }, companyId);
      const doneRun = await waitForRun(run.id, run.defaultDatasetId, chunk.length,
        async (c, t) => { await onProgress?.(i + c, queries.length); }, companyId);
      const items = await getDatasetItems(doneRun.defaultDatasetId, companyId);

      for (const item of items) {
        const term = item?.searchQuery?.term || item?.searchQuery?.query || "";
        const idxs = queryToIdx.get(term) || [];
        const urls: string[] = (item?.organicResults || []).map((o: any) => o?.url).filter(Boolean);
        for (const idx of idxs) {
          const r = results[idx];
          let got = false;
          for (const platform of SOCIAL_PLATFORMS) {
            if ((r as any)[platform]) continue;
            const h = urls.map(u => handleFromUrl(u, platform)).find(Boolean);
            if (h) { (r as any)[platform] = h; got = true; }
          }
          if (got) enriched++;
        }
      }
    } catch (err: any) {
      logger.warn(`[SocialEnricher/batch] chunk ${i / CHUNK + 1} falhou: ${err?.message}`);
    }
    await onProgress?.(Math.min(i + CHUNK, queries.length), queries.length);
  }

  logger.info(`[SocialEnricher/batch] ${enriched}/${targets.length} leads ganharam rede social (${queries.length} queries)`);
  return enriched;
};

// Passo 3 (Apify): para leads que ganharam Instagram, o profile-scraper em lote
// traz telefone/email públicos de perfis business — 1 run por chunk de 100.
export const enrichIgPhonesBatch = async (
  results: ScraperResult[],
  companyId?: number,
  onProgress?: (cur: number, total: number) => Promise<void>
): Promise<void> => {
  if (!(await isApifyConfigured(companyId))) return;
  const handles = results
    .filter(r => r.instagram && !r.phone && !r.instagramPhone)
    .map(r => r.instagram as string);
  if (!handles.length) return;

  const profiles = await enrichProfilesBatchViaApify(handles, companyId, onProgress);
  for (const r of results) {
    const p = profiles.get(String(r.instagram || "").toLowerCase());
    if (!p) continue;
    if (p.phone) { r.instagramPhone = p.phone; if (!r.phone) r.phone = p.phone; }
    if (p.email && !r.email) r.email = p.email;
  }
};
