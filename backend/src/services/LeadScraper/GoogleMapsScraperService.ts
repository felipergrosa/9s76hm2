import puppeteer from "puppeteer";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ponytail: selectors based on 2025 Google Maps DOM — update if Google changes structure
const SEL = {
  feed: 'div[role="feed"]',
  article: 'div[role="article"]',
  nameLink: 'a[aria-label]',
  phone: '[data-tooltip="Copiar número de telefone"], button[data-item-id="phone:tel"]',
  website: '[data-tooltip="Abrir o site"], a[data-tooltip*="site"], a[aria-label*="site Web"]',
  address: 'button[data-item-id="address"], [data-tooltip="Copiar endereço"]',
  rating: 'span.ceNzKf, span.MW4etd, span[aria-label*="estrela"]'
};

export const scrapeGoogleMaps = async (
  keyword: string,
  city: string,
  maxResults = 50,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,900"
    ]
  });

  const results: ScraperResult[] = [];
  const processedNames = new Set<string>();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });

    const query = encodeURIComponent(`${keyword} ${city}`);
    await page.goto(`https://www.google.com/maps/search/${query}?hl=pt-BR`, {
      waitUntil: "networkidle0",
      timeout: 45000
    });

    // Accept cookie consent if shown
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button, a"))
        .find((el: any) => /aceitar|accept|agree/i.test(el.textContent || ""));
      if (btn) (btn as HTMLElement).click();
    });
    await delay(1500);

    let scrollAttempts = 0;
    const MAX_SCROLL = Math.ceil(maxResults / 4) + 10;

    while (results.length < maxResults && scrollAttempts < MAX_SCROLL) {
      const cards = await page.$$(SEL.article);

      for (const card of cards) {
        if (results.length >= maxResults) break;
        const nameEl = await card.$(SEL.nameLink).catch(() => null);
        if (!nameEl) continue;
        const name = await nameEl.evaluate((el: Element) =>
          el.getAttribute("aria-label") || ""
        ).catch(() => "");
        if (!name || processedNames.has(name)) continue;
        processedNames.add(name);

        await card.click().catch(() => {});
        await delay(1800 + Math.random() * 600);

        const details = await page.evaluate((sel: typeof SEL) => {
          const text = (s: string) =>
            (document.querySelector(s) as HTMLElement)?.textContent?.trim() || "";
          const href = (s: string) =>
            (document.querySelector(s) as HTMLAnchorElement)?.href || "";
          const cleanPhone = (s: string) => s.replace(/[\s\-().]/g, "");

          return {
            phone: cleanPhone(text(sel.phone)),
            website: href(sel.website),
            address: text(sel.address),
            rating: text(sel.rating)
          };
        }, SEL);

        results.push({ name, ...details });
        logger.info(`[GoogleMapsScraper] ${results.length}/${maxResults}: ${name}`);
        if (onProgress) await onProgress(results.length, maxResults);
      }

      // Scroll the result feed
      const fed = await page.$(SEL.feed).catch(() => null);
      if (fed) {
        await page.evaluate((el: Element) => { el.scrollTop += 700; }, fed);
      }
      await delay(900 + Math.random() * 400);
      scrollAttempts++;
    }
  } catch (err: any) {
    logger.error(`[GoogleMapsScraper] error: ${err.message}`);
  } finally {
    await browser.close();
  }

  return results;
};
