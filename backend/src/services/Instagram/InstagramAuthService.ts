import crypto from "crypto";
import puppeteer from "../../libs/puppeteerStealth";
import InstagramSession from "../../models/InstagramSession";
import logger from "../../utils/logger";

const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * base * 0.4);

// In-memory map for 2FA pending logins (browser stays open until code submitted or timeout)
const PENDING_2FA = new Map<string, {
  browser: any; page: any; timer: NodeJS.Timeout; username: string;
}>();

export const loginInstagram = async (
  companyId: number,
  username: string,
  password: string
): Promise<{ status: "success" | "needs_2fa"; pendingId?: string }> => {
  const browser = await (puppeteer as any).launch({ headless: true, args: LAUNCH_ARGS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2", timeout: 30000,
    });

    // Dismiss cookie consent if present (varies by region)
    try {
      const btns = await page.$$("button");
      for (const btn of btns) {
        const text = await btn.evaluate((el: any) => el.textContent?.toLowerCase() || "");
        if (text.includes("allow") || text.includes("aceitar") || text.includes("accept")) {
          await btn.click();
          await delay(jitter(500));
          break;
        }
      }
    } catch {}

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });

    await page.type('input[name="username"]', username, { delay: jitter(80) });
    await delay(jitter(300));
    await page.type('input[name="password"]', password, { delay: jitter(80) });
    await delay(jitter(300));

    await Promise.all([
      page.click('button[type="submit"]'),
      Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        page.waitForSelector('input[name="verificationCode"]', { timeout: 20000 }),
        page.waitForSelector('#verificationCodeDescription', { timeout: 20000 }),
      ]).catch(() => {}),
    ]);

    await delay(1500);

    // Detect 2FA
    const twoFa = await page.$('input[name="verificationCode"]')
      .catch(() => null) as any;
    const twoFaAlt = await page.$('#verificationCodeDescription').catch(() => null);

    if (twoFa || twoFaAlt) {
      const pendingId = crypto.randomBytes(16).toString("hex");
      const timer = setTimeout(() => {
        PENDING_2FA.get(pendingId)?.browser.close().catch(() => {});
        PENDING_2FA.delete(pendingId);
        logger.warn(`[Instagram] 2FA session ${pendingId} expired`);
      }, 5 * 60 * 1000);
      PENDING_2FA.set(pendingId, { browser, page, timer, username });
      return { status: "needs_2fa", pendingId };
    }

    // Handle "Save login info" prompt
    try {
      const notNow = await page.waitForSelector(
        'button:not([type="submit"])', { timeout: 3000 }
      );
      if (notNow) { await notNow.click(); await delay(jitter(500)); }
    } catch {}

    const cookies = await page.cookies();
    await browser.close();

    await saveSession(companyId, username, cookies);
    return { status: "success" };
  } catch (err: any) {
    await browser.close().catch(() => {});
    throw err;
  }
};

export const submitTwoFa = async (
  companyId: number,
  pendingId: string,
  code: string
): Promise<void> => {
  const pending = PENDING_2FA.get(pendingId);
  if (!pending) throw new Error("Sessão 2FA expirou (5 min). Faça login novamente.");

  const { browser, page, timer, username } = pending;
  clearTimeout(timer);
  PENDING_2FA.delete(pendingId);

  try {
    await page.type('input[name="verificationCode"]', code, { delay: jitter(80) });
    await delay(jitter(300));

    // Submit 2FA
    const submitBtn = await page.$('button[type="button"]:not([aria-label])');
    if (submitBtn) await submitBtn.click();

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await delay(1000);

    const cookies = await page.cookies();
    await browser.close();
    await saveSession(companyId, username, cookies);
  } catch (err: any) {
    await browser.close().catch(() => {});
    throw err;
  }
};

export const saveSession = async (
  companyId: number,
  username: string,
  cookies: any[]
): Promise<void> => {
  const [session] = await InstagramSession.findOrCreate({
    where: { companyId },
    defaults: { companyId, username, cookies, status: "active", lastLoginAt: new Date() } as any,
  });
  await session.update({ username, cookies, status: "active", lastLoginAt: new Date() });
};

export const getSessionCookies = async (companyId: number): Promise<any[] | null> => {
  const session = await InstagramSession.findOne({
    where: { companyId, status: "active" },
  });
  if (!session) return null;
  await session.update({ lastUsedAt: new Date() });
  return session.cookies as any[];
};

export const markSessionExpired = async (companyId: number): Promise<void> => {
  await InstagramSession.update({ status: "expired" }, { where: { companyId } });
};

export const clearSession = async (companyId: number): Promise<void> => {
  await InstagramSession.destroy({ where: { companyId } });
};

export const getSessionStatus = async (companyId: number) => {
  const session = await InstagramSession.findOne({ where: { companyId } });
  if (!session) return null;
  return {
    username: session.username,
    status: session.status,
    lastLoginAt: session.lastLoginAt,
    lastUsedAt: session.lastUsedAt,
  };
};
