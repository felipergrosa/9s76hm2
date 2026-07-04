import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import { InstagramBrowserSession } from "../Instagram/InstagramProfileService";
import { markSessionExpired } from "../Instagram/InstagramAuthService";

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
  linkedin:  /linkedin\.com\/company\/([a-zA-Z0-9%_-]{2,80})(?:[\/?"'`<\s\n]|$)/g,
};

function extractHandle(html: string, platform: keyof typeof PATTERNS): string | null {
  const re = new RegExp(PATTERNS[platform].source, "gi");
  for (const m of html.matchAll(re)) {
    const handle = decodeURIComponent(m[1]).toLowerCase();
    if (!EXCLUDED.has(handle) && !/^\d+$/.test(handle)) return handle;
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await http.get(url);
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

async function fromWebsite(url: string): Promise<Partial<Record<"instagram" | "twitter" | "linkedin", string>>> {
  const base = url.startsWith("http") ? url : `https://${url}`;
  const html = await fetchHtml(base);
  if (!html) return {};
  return {
    instagram: extractHandle(html, "instagram") ?? undefined,
    twitter:   extractHandle(html, "twitter")   ?? undefined,
    linkedin:  extractHandle(html, "linkedin")  ?? undefined,
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
  igSession?: InstagramBrowserSession
): Promise<Pick<ScraperResult, "instagram" | "twitter" | "linkedin" | "instagramPhone">> => {
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

  // 3. Instagram bio → BR phone
  // Uses Puppeteer session (logged-in, sees business contact button) when available,
  // falls back to axios meta-description parse otherwise.
  if (out.instagram) {
    await delay(600);
    if (igSession) {
      try {
        const info = await igSession.getContactInfo(out.instagram as string);
        if (info.phone) out.instagramPhone = info.phone;
        if (info.email && !out.email) (out as any).email = info.email;
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") {
          // Session expired mid-job; mark in DB so UI shows reconnect prompt
          // companyId not in scope here — handled in LeadScraperJobService catch
          throw err;
        }
      }
    } else {
      const phone = await instagramBioPhone(out.instagram as string);
      if (phone) out.instagramPhone = phone;
    }
  }

  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v != null && v !== "")
  ) as any;
};
