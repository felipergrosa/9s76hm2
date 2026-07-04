import puppeteer from "../../libs/puppeteerStealth";
import logger from "../../utils/logger";

const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * base * 0.5);

const BR_PHONE = /(?:\+55[\s-]?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}[-\s]?\d{4}/;

export interface InstagramContactInfo {
  phone: string;
  email: string;
  bio: string;
}

// One browser instance reused across all profiles in a scraping session.
// Open once → visit N profiles → close. Much faster than browser-per-profile.
export class InstagramBrowserSession {
  private browser: any;

  private constructor(browser: any) {
    this.browser = browser;
  }

  static async create(cookies: any[]): Promise<InstagramBrowserSession> {
    const browser = await (puppeteer as any).launch({ headless: true, args: LAUNCH_ARGS });

    // Seed cookies on instagram.com domain before any profile visit
    const page = await browser.newPage();
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const domainCookies = cookies.map((c: any) => ({
      ...c,
      domain: c.domain || ".instagram.com",
    }));
    await page.setCookie(...domainCookies);
    await page.close();

    return new InstagramBrowserSession(browser);
  }

  async getContactInfo(handle: string): Promise<InstagramContactInfo> {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
      await page.goto(`https://www.instagram.com/${handle}/`, {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await delay(jitter(800));

      // Check for redirect to login (session expired)
      const url = page.url();
      if (url.includes("/accounts/login")) {
        throw new Error("SESSION_EXPIRED");
      }

      // 1. Direct contact links — visible on business accounts without clicking
      const phone = await page
        .$eval('a[href^="tel:"]', (el: any) => el.href.replace("tel:", "").replace(/\s/g, ""))
        .catch(() => "");
      const email = await page
        .$eval('a[href^="mailto:"]', (el: any) => el.href.replace("mailto:", ""))
        .catch(() => "");

      // 2. Extract bio from embedded page data (more stable than CSS selectors)
      const bio: string = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const text = s.textContent || "";
          if (text.includes('"biography"')) {
            const m = text.match(/"biography":"((?:[^"\\]|\\.)*)"/);
            if (m) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          }
        }
        // Fallback: header span text (less stable but catches simple cases)
        const spans = Array.from(document.querySelectorAll("header span"));
        return spans.map((s: any) => s.textContent).join(" ").trim();
      }).catch(() => "");

      // 3. Regex BR phone from bio when tel: link not present
      const resolvedPhone = phone || (bio.match(BR_PHONE)?.[0]?.replace(/[\s()-]/g, "") ?? "");

      return { phone: resolvedPhone, email, bio };
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") throw err;
      logger.warn(`[Instagram] Failed to get contact info for @${handle}: ${err.message}`);
      return { phone: "", email: "", bio: "" };
    } finally {
      await page.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    await this.browser.close().catch(() => {});
  }
}
