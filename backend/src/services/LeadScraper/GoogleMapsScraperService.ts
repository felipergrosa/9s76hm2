import puppeteer from "../../libs/puppeteerStealth";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const norm = (s: string) => (s || "").toLowerCase().trim();

const SEL = {
  feed: 'div[role="feed"]',
  main: 'div[role="main"]',
  placeLink: 'div[role="article"] a[href*="/maps/place/"]'
};

interface PanelData {
  h1: string;
  phone: string;
  website: string;
  address: string;
  rating: string;
  category: string;
}

// Extrai os dados do painel de detalhes — roda dentro do browser (escopo div[role="main"]).
const readPanel = (): PanelData | null => {
  const main = document.querySelector('div[role="main"]');
  if (!main) return null;
  const q = (s: string) => main.querySelector(s);

  const phoneBtn = q('button[data-item-id^="phone:tel"]');
  const site = (q('a[data-item-id="authority"]') ||
    q('a[data-tooltip*="site"]')) as HTMLAnchorElement | null;
  const addrBtn = q('button[data-item-id="address"]');
  const rateImg = q('span[role="img"][aria-label*="estrela"]');

  return {
    h1: q("h1")?.textContent?.trim() || "",
    phone:
      (phoneBtn?.getAttribute("data-item-id") || "").replace(/^phone:tel:/, "") ||
      phoneBtn?.textContent?.trim() || "",
    website: site?.href || "",
    address:
      (addrBtn?.getAttribute("aria-label") || "").replace(/^Endereço:\s*/i, "") ||
      addrBtn?.textContent?.trim() || "",
    rating:
      rateImg?.getAttribute("aria-label")?.match(/[\d.,]+/)?.[0] ||
      q("span.MW4etd")?.textContent?.trim() || "",
    category: q('button[jsaction*="category"]')?.textContent?.trim() || ""
  };
};

// Lista os cards visíveis do feed (name + url do place). Roda dentro do browser.
const listPlaces = (): Array<{ name: string; url: string }> =>
  Array.from(
    document.querySelectorAll('div[role="article"] a[href*="/maps/place/"]')
  ).map(a => ({
    name: ((a.getAttribute("aria-label") || a.textContent || "") as string).trim(),
    url: (a as HTMLAnchorElement).href
  }));

// Endereço BR no Maps termina em "..., Cidade - UF, CEP" ou "Cidade, UF" — parse defensivo.
const parseMunicipioUf = (
  address: string
): { municipio?: string; uf?: string } => {
  if (!address) return {};
  const m =
    /,\s*([^,\d][^,]*?)\s*-\s*([A-Z]{2})(?=\s*[-–,]|\s*$)/.exec(address) ||
    /,\s*([^,\d][^,]*?)\s*,\s*([A-Z]{2})\s*$/.exec(address);
  if (!m) return {};
  return { municipio: m[1].trim(), uf: m[2] };
};

const checkBlocked = (page: any) => {
  if (page.url().includes("/sorry/")) {
    throw new Error("Google bloqueou a requisição (captcha/rate limit)");
  }
};

export const scrapeGoogleMaps = async (
  keyword: string,
  city: string,
  maxResults = 50,
  onProgress?: (current: number, total: number) => Promise<void>,
  opts?: { state?: string }
): Promise<ScraperResult[]> => {
  const browser = await (puppeteer as any).launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,900"
    ]
  });

  const results: ScraperResult[] = [];
  // caller passa city já concatenado ("São Paulo SP") — separa UF para fallback de municipio/uf
  const ufFromCity = /\s([A-Z]{2})\s*$/.exec(city)?.[1];
  const cityFallback = ufFromCity ? city.slice(0, -3).trim() : city.trim();
  const ufFallback = opts?.state || ufFromCity;

  const buildResult = (p: PanelData, name: string, url: string): ScraperResult => {
    const loc = parseMunicipioUf(p.address);
    return {
      name: name || p.h1,
      phone: p.phone || undefined,
      website: p.website || undefined,
      address: p.address || undefined,
      rating: p.rating || undefined,
      category: p.category || undefined,
      municipio: loc.municipio || cityFallback || undefined,
      uf: loc.uf || ufFallback,
      googleMapsUrl: url
    } as ScraperResult;
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setCookie({ name: "CONSENT", value: "YES+cb", domain: ".google.com" });

    const query = encodeURIComponent(`${keyword} ${city}`);
    await page.goto(`https://www.google.com/maps/search/${query}?hl=pt-BR`, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    checkBlocked(page);

    // fallback: clique em "aceitar" caso a tela de consentimento ainda apareça
    await page
      .evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(el =>
          /aceitar|concordo|accept|agree/i.test(el.textContent || "")
        );
        if (btn) (btn as HTMLElement).click();
      })
      .catch(() => {});
    await delay(1500);

    await page
      .waitForSelector(`${SEL.feed}, ${SEL.main}`, { timeout: 20000 })
      .catch(() => {
        throw new Error("estrutura do Google Maps não reconhecida");
      });
    checkBlocked(page);

    const hasFeed = !!(await page.$(SEL.feed));

    // busca com resultado único: Maps abre o painel de detalhes sem feed
    if (!hasFeed) {
      await page.waitForSelector(`${SEL.main} h1`, { timeout: 15000 }).catch(() => {});
      const panel = await page.evaluate(readPanel).catch(() => null);
      if (!panel || !panel.h1) {
        throw new Error("estrutura do Google Maps não reconhecida");
      }
      results.push(buildResult(panel, panel.h1, page.url()));
      logger.info(`[GoogleMapsScraper] 1/1: ${panel.h1}`);
      if (onProgress) await onProgress(1, 1);
      return results;
    }

    // Fase A — scroll do feed coletando {name,url}; dedupe pelo href (contém cid único)
    const places = new Map<string, string>();
    let idleScrolls = 0;
    let scrolls = 0;
    const MAX_SCROLLS = Math.ceil(maxResults * 2.5) + 30; // trava de segurança

    while (places.size < maxResults && idleScrolls < 4 && scrolls < MAX_SCROLLS) {
      const batch = await page.evaluate(listPlaces).catch(() => []);
      const before = places.size;
      for (const p of batch) {
        if (p.url && !places.has(p.url)) places.set(p.url, p.name);
        if (places.size >= maxResults) break;
      }
      idleScrolls = places.size === before ? idleScrolls + 1 : 0;

      const ended = await page
        .evaluate(() =>
          /chegou ao (final|fim) da lista|reached the end of the list/i.test(
            document.querySelector('div[role="feed"]')?.textContent || ""
          )
        )
        .catch(() => false);
      if (ended) break;

      await page
        .evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollTop = feed.scrollHeight;
        })
        .catch(() => {});
      await delay(1100 + Math.random() * 700);
      scrolls++;
    }

    const target = Math.min(places.size, maxResults);

    // Fase B — visita cada URL de place e extrai do painel (sem race condition com o feed)
    for (const [url, expectedName] of places) {
      if (results.length >= maxResults) break;

      let panel: PanelData | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        checkBlocked(page);
        await page
          .waitForSelector(`${SEL.main} h1`, { timeout: 15000 })
          .catch(() => {});
        panel = await page.evaluate(readPanel).catch(() => null);

        if (!panel || !panel.h1) {
          logger.warn(`[GoogleMapsScraper] painel vazio para ${url} (tentativa ${attempt + 1})`);
          panel = null;
          continue;
        }
        if (expectedName && norm(panel.h1) !== norm(expectedName)) {
          logger.warn(
            `[GoogleMapsScraper] painel divergente — esperado "${expectedName}", obtido "${panel.h1}" (tentativa ${attempt + 1})`
          );
          panel = null;
          continue;
        }
        break;
      }
      if (!panel) continue;

      results.push(buildResult(panel, expectedName, url));
      logger.info(`[GoogleMapsScraper] ${results.length}/${target}: ${panel.h1 || expectedName}`);
      if (onProgress) await onProgress(results.length, target);
    }

    if (places.size > 0 && results.length === 0) {
      throw new Error(
        "nenhum lead extraído — possível bloqueio ou mudança de estrutura do Google Maps"
      );
    }

    return results;
  } finally {
    await browser.close().catch(() => {});
  }
};
