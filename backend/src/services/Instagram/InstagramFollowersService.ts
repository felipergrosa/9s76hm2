import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * base * 0.5);

const IG_HEADERS = (cookies: string) => ({
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept": "*/*",
  "Cookie": cookies,
  "X-IG-App-ID": "936619743392459", // public Instagram web app ID
  "X-Requested-With": "XMLHttpRequest",
});

function cookiesToString(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

async function getUserId(handle: string, cookieStr: string): Promise<string | null> {
  try {
    const { data } = await axios.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`,
      { headers: IG_HEADERS(cookieStr), timeout: 10000 }
    );
    return data?.data?.user?.id ?? null;
  } catch (err: any) {
    logger.warn(`[Instagram] Failed to get user_id for @${handle}: ${err.message}`);
    return null;
  }
}

export const scrapeFollowers = async (
  targetHandle: string,
  cookies: any[],
  maxResults: number,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const cookieStr = cookiesToString(cookies);

  const userId = await getUserId(targetHandle.replace(/^@/, ""), cookieStr);
  if (!userId) throw new Error(`Não foi possível encontrar o perfil @${targetHandle}. Verifique se a conta existe e é pública.`);

  const results: ScraperResult[] = [];
  let cursor = "";
  const max = Math.min(maxResults, 5000);

  while (results.length < max) {
    const url = `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50${cursor ? `&max_id=${cursor}` : ""}`;

    let data: any;
    try {
      const res = await axios.get(url, { headers: IG_HEADERS(cookieStr), timeout: 12000 });
      data = res.data;
    } catch (err: any) {
      if (err.response?.status === 429) {
        logger.warn("[Instagram] Rate limited on followers, stopping early");
        break;
      }
      throw err;
    }

    const users: any[] = data.users || [];
    for (const u of users) {
      if (results.length >= max) break;
      results.push({
        name: u.full_name || u.username || "",
        // ponytail: no phone yet — enriched in social enrichment phase like other sources
        instagram: u.username,
        website: u.external_url || "",
        category: u.category || "",
        situacao: u.is_private ? "privada" : "pública",
        porte: u.is_verified ? "verificada" : "",
      });
    }

    await onProgress?.(results.length, max);

    cursor = data.next_max_id || "";
    if (!cursor || !users.length) break;

    // ponytail: jitter delay keeps rate under Instagram's threshold (~20 req/min safe)
    await delay(jitter(3000));
  }

  return results;
};
