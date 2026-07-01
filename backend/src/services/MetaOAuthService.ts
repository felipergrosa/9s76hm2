import axios from "axios";
import crypto from "crypto";
import logger from "../utils/logger";

const GRAPH = "https://graph.facebook.com/v19.0";

// ponytail: state is HMAC-signed JSON {companyId, channel, nonce, exp}
export const createOAuthState = (companyId: number, channel: string): string => {
  const payload = JSON.stringify({ companyId, channel, nonce: crypto.randomBytes(8).toString("hex"), exp: Date.now() + 30 * 60 * 1000 });
  const secret = process.env.APP_SECRET_META_STATE || process.env.JWT_SECRET || "whaticket-oauth";
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
};

export const verifyOAuthState = (state: string): { companyId: number; channel: string } | null => {
  try {
    const { payload, sig } = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    const secret = process.env.APP_SECRET_META_STATE || process.env.JWT_SECRET || "whaticket-oauth";
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return null;
    return { companyId: data.companyId, channel: data.channel };
  } catch {
    return null;
  }
};

export const buildOAuthUrl = (companyId: number, channel: "facebook" | "instagram"): string => {
  const appId = process.env.META_APP_ID || "";
  const redirectUri = `${process.env.BACKEND_URL}/meta-oauth/callback`;
  const state = createOAuthState(companyId, channel);
  const scope = channel === "instagram"
    ? "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement"
    : "pages_show_list,pages_read_engagement,pages_messaging";
  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;
};

// Exchange short-lived code for long-lived page access token and discover pages
export const exchangeCodeForPages = async (code: string, channel: string): Promise<Array<{
  pageId: string;
  pageName: string;
  pageToken: string;
  instagramAccountId?: string;
}>> => {
  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const redirectUri = `${process.env.BACKEND_URL}/meta-oauth/callback`;

  // Step 1: short-lived user token
  const { data: tokenData } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }
  });
  const shortToken = tokenData.access_token;

  // Step 2: long-lived user token
  const { data: llData } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken }
  });
  const longToken = llData.access_token;

  // Step 3: list pages
  const { data: pagesData } = await axios.get(`${GRAPH}/me/accounts`, {
    params: { access_token: longToken, fields: "id,name,access_token" }
  });

  const pages = pagesData.data || [];
  const result = [];

  for (const page of pages) {
    const entry: any = { pageId: page.id, pageName: page.name, pageToken: page.access_token };

    // Step 4 (Instagram): discover connected Instagram account
    if (channel === "instagram") {
      try {
        const { data: igData } = await axios.get(`${GRAPH}/${page.id}`, {
          params: { access_token: page.access_token, fields: "instagram_business_account" }
        });
        if (igData.instagram_business_account?.id) {
          entry.instagramAccountId = igData.instagram_business_account.id;
        }
      } catch {
        // page has no IG account, skip
      }
      if (!entry.instagramAccountId) continue;
    }
    result.push(entry);
  }

  if (!result.length) throw new Error("Nenhuma página Meta compatível encontrada na conta.");
  return result;
};

// Subscribe app to page webhook
export const subscribePageWebhook = async (pageId: string, pageToken: string): Promise<void> => {
  try {
    await axios.post(`${GRAPH}/${pageId}/subscribed_apps`, null, {
      params: { access_token: pageToken, subscribed_fields: "messages,messaging_postbacks,message_deliveries,message_reads,comments" }
    });
  } catch (err: any) {
    logger.warn(`[MetaOAuth] subscribePageWebhook failed for ${pageId}: ${err.message}`);
  }
};
