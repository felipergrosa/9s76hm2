import { ScraperResult, ScraperFilters, MultiValue } from "../../models/LeadScraperJob";
import { scrapeGoogleMaps } from "./GoogleMapsScraperService";
import { scrapeViaSidecar, isSidecarAvailable } from "./GmapsSidecarService";
import { isGmapsApifyConfigured, scrapeGoogleMapsViaApify } from "./GoogleMapsApifyProvider";
import { searchCnpjsByFilters } from "./CnpjSearchService";
import { scrapeConselho } from "./ConselhoScraperService";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import logger from "../../utils/logger";

// Busca global: dispara as fontes habilitadas em paralelo e MERGEIA resultados
// da mesma empresa (mesmo CNPJ, telefone canônico, handle IG ou nome+UF) num
// único lead — cada campo vazio é preenchido pela fonte que o trouxe, e
// `sources` registra de onde o lead veio (badge multi-fonte na UI).

const toArray = (v?: MultiValue): string[] => {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(s => String(s).trim()).filter(Boolean);
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Fontes ──────────────────────────────────────────────────────────────────

async function scrapeMapsBranch(
  filters: ScraperFilters,
  companyId: number,
  onProgress: (cur: number, total: number) => Promise<void>,
  checkCancelled: () => void
): Promise<ScraperResult[]> {
  const { keyword = "", city, state, lat, lng, radiusKm } = filters;
  const geo = typeof lat === "number" && typeof lng === "number"
    ? { lat, lng, radiusKm: radiusKm || 5 }
    : undefined;

  const cities = toArray(city);
  const states = toArray(state);
  const cityQueries: string[] = geo
    ? [""]
    : cities.length
      ? (states.length ? cities.flatMap(c => states.map(s => `${c} ${s}`)) : cities)
      : states.length ? states : [""];

  const cap = Math.min(filters.maxResults || 200, 1000);
  const perQueryCap = Math.max(1, Math.ceil(cap / cityQueries.length));

  const useApify = await isGmapsApifyConfigured(companyId);
  const useSidecar = !useApify && (await isSidecarAvailable());
  logger.info(`[GlobalSearch] maps via ${useApify ? "apify" : useSidecar ? "sidecar" : "puppeteer"} (${cityQueries.length} queries)`);

  const results: ScraperResult[] = [];
  for (let qi = 0; qi < cityQueries.length; qi++) {
    checkCancelled();
    if (results.length >= cap) break;
    const share = async (cur: number, total: number) => {
      checkCancelled();
      const qShare = 100 / cityQueries.length;
      await onProgress(Math.round(qi * qShare + (cur / Math.max(total, 1)) * qShare), 100);
    };
    const remaining = Math.min(perQueryCap, cap - results.length);
    const batch = useApify
      ? await scrapeGoogleMapsViaApify(keyword, cityQueries[qi], remaining, share, { state: states[0], geo, companyId })
      : useSidecar
        ? await scrapeViaSidecar(keyword, cityQueries[qi], remaining, share, geo)
        : await scrapeGoogleMaps(keyword, cityQueries[qi], remaining, share, { state: states[0], geo });
    results.push(...batch);
  }
  return results;
}

async function scrapeReceitaBranch(
  filters: ScraperFilters,
  onProgress: (cur: number, total: number) => Promise<void>,
  checkCancelled: () => void
): Promise<ScraperResult[]> {
  return searchCnpjsByFilters(
    {
      keyword: filters.keyword,
      uf: filters.state || filters.uf,
      municipio: filters.city || filters.municipio,
      maxResults: Math.min(filters.maxResults || 200, 1000),
      situacao: filters.situacao,
    } as ScraperFilters,
    async (cur, total) => {
      checkCancelled();
      await onProgress(cur, total);
    }
  );
}

async function scrapeConselhoBranch(
  filters: ScraperFilters,
  onProgress: (cur: number, total: number) => Promise<void>,
  checkCancelled: () => void
): Promise<ScraperResult[]> {
  return scrapeConselho(
    {
      conselho: filters.conselho || "cau",
      conselhoTipo: filters.conselhoTipo || "ambos",
      uf: filters.state || filters.uf,
      municipio: filters.city || filters.municipio,
      nome: filters.keyword,
      maxResults: filters.maxResults,
    } as ScraperFilters,
    async (cur, total) => {
      checkCancelled();
      await onProgress(cur, total);
    }
  );
}

// ── Merge por identidade (union-find) ───────────────────────────────────────

const normText = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const identityKeys = (r: ScraperResult): string[] => {
  const keys: string[] = [];
  if (r.cnpj) keys.push(`cnpj:${r.cnpj.replace(/\D/g, "")}`);
  if (r.phone) {
    const { canonical } = safeNormalizePhoneNumber(r.phone);
    if (canonical) keys.push(`tel:${canonical}`);
  }
  if (r.instagram) keys.push(`ig:${r.instagram.trim().toLowerCase().replace(/^@+/, "")}`);
  const nome = normText(r.razaoSocial || r.nomeFantasia || r.name || "");
  const uf = (r.uf || "").toUpperCase().trim();
  if (nome.length >= 4 && uf) keys.push(`nome:${nome}|${uf}`);
  return keys;
};

// Campos escalares: primeiro valor não-vazio vence; merged acumula de todas as
// fontes. RF (cnpj_search) tem prioridade nos campos cadastrais (razaoSocial,
// situacao, municipio, uf...); Maps ganha em rating/address/googleMapsUrl.
const MERGE_SCALAR_FIELDS: (keyof ScraperResult)[] = [
  "name", "phone", "email", "website", "address", "rating", "category",
  "cnpj", "razaoSocial", "nomeFantasia", "cnaeId", "cnaeDescricao",
  "naturezaJuridica", "situacao", "porte", "municipio", "uf",
  "instagram", "twitter", "linkedin", "instagramPhone", "googleMapsUrl",
  "capitalSocial", "dataAbertura", "registro", "registroTipo",
];

const mergeInto = (target: ScraperResult, src: ScraperResult): void => {
  for (const f of MERGE_SCALAR_FIELDS) {
    const v = src[f];
    if (v !== undefined && v !== "" && (target[f] === undefined || target[f] === "")) {
      (target as any)[f] = v;
    }
  }
  const origins = new Set([...(target.sources || []), ...(src.sources || [])]);
  target.sources = [...origins];
  const enriched = new Set([...(target.enrichedFrom || []), ...(src.enrichedFrom || [])]);
  if (enriched.size) target.enrichedFrom = [...enriched];
};

export const mergeByIdentity = (items: ScraperResult[]): ScraperResult[] => {
  const parent = items.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };

  const byKey = new Map<string, number>();
  items.forEach((r, i) => {
    for (const k of identityKeys(r)) {
      const seen = byKey.get(k);
      if (seen !== undefined) parent[find(i)] = find(seen);
      else byKey.set(k, i);
    }
  });

  const groups = new Map<number, ScraperResult[]>();
  items.forEach((r, i) => {
    const root = find(i);
    const g = groups.get(root) || [];
    g.push(r);
    groups.set(root, g);
  });

  const out: ScraperResult[] = [];
  for (const members of groups.values()) {
    // base = o membro com mais dados cadastrais (CNPJ primeiro)
    members.sort((a, b) => (b.cnpj ? 1 : 0) - (a.cnpj ? 1 : 0));
    const merged = { ...members[0] };
    for (let i = 1; i < members.length; i++) mergeInto(merged, members[i]);
    const origins = new Set(members.flatMap(m => m.sources || []));
    if (origins.size) merged.sources = [...origins];
    out.push(merged);
  }
  return out;
};

// ── Orquestrador ────────────────────────────────────────────────────────────

export interface GlobalSearchOpts {
  companyId: number;
  filters: ScraperFilters;
  onProgress: (pct: number) => Promise<void>;
  checkCancelled: () => void;
}

export const GLOBAL_SOURCES = ["google_maps", "cnpj_search", "conselho"] as const;
export type GlobalSourceKey = typeof GLOBAL_SOURCES[number];

export const runGlobalSearch = async (opts: GlobalSearchOpts): Promise<ScraperResult[]> => {
  const { filters, companyId, onProgress, checkCancelled } = opts;

  const requested = Array.isArray(filters.sources) && filters.sources.length
    ? filters.sources.filter(s => (GLOBAL_SOURCES as readonly string[]).includes(s))
    : [...GLOBAL_SOURCES];
  const enabled = requested as GlobalSourceKey[];
  if (!enabled.length) throw new Error("Nenhuma fonte válida selecionada para a busca global.");

  // CAU só roda quando selecionado (não faz sentido para todo segmento)
  const tasks: { source: GlobalSourceKey; run: () => Promise<ScraperResult[]> }[] = [];
  const localPct: number[] = [];
  const report = async () => {
    const avg = localPct.reduce((a, b) => a + b, 0) / localPct.length;
    await onProgress(Math.round(avg));
  };
  const mkProgress = (idx: number) => async (cur: number, total: number) => {
    checkCancelled();
    localPct[idx] = Math.round((cur / Math.max(total, 1)) * 100);
    await report();
  };

  for (const src of enabled) {
    const idx = tasks.length;
    localPct.push(0);
    if (src === "google_maps") {
      tasks.push({ source: src, run: () => scrapeMapsBranch(filters, companyId, mkProgress(idx), checkCancelled) });
    } else if (src === "cnpj_search") {
      tasks.push({ source: src, run: () => scrapeReceitaBranch(filters, mkProgress(idx), checkCancelled) });
    } else if (src === "conselho") {
      tasks.push({ source: src, run: () => scrapeConselhoBranch(filters, mkProgress(idx), checkCancelled) });
    }
  }

  // Paralelo com isolamento de falha: uma fonte quebrada não derruba as demais
  const settled = await Promise.allSettled(tasks.map(async (t, i) => {
    const rs = await t.run();
    localPct[i] = 100;
    await report();
    return rs.map(r => ({ ...r, sources: [t.source] }));
  }));

  const all: ScraperResult[] = [];
  const failures: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") all.push(...s.value);
    else {
      failures.push(`${tasks[i].source}: ${s.reason?.message || "falhou"}`);
      logger.warn(`[GlobalSearch] fonte ${tasks[i].source} falhou: ${s.reason?.message}`);
    }
  });

  // Se o usuário cancelou durante o scrape, as fontes abortaram como "rejected"
  // no allSettled — re-lança como cancelamento, não como falha agregada
  checkCancelled();

  if (!all.length && failures.length) {
    throw new Error(`Todas as fontes falharam — ${failures.join("; ")}`);
  }

  const merged = mergeByIdentity(all);
  const multi = merged.filter(m => (m.sources?.length || 0) > 1).length;
  logger.info(`[GlobalSearch] ${all.length} brutos → ${merged.length} únicos (${multi} multi-fonte, ${failures.length} fonte(s) falharam)`);

  return merged;
};
