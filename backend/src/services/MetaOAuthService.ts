import axios from "axios";
import crypto from "crypto";
import logger from "../utils/logger";
import cacheLayer from "../libs/cache";

const GRAPH = "https://graph.facebook.com/v19.0";

// Fail fast: sem segredo para assinar o state OAuth o fluxo não pode operar.
// Nunca usar segredo hardcoded como fallback.
const META_STATE_SECRET = process.env.APP_SECRET_META_STATE || process.env.JWT_SECRET;
if (!META_STATE_SECRET) {
  throw new Error("[MetaOAuth] APP_SECRET_META_STATE ou JWT_SECRET precisa estar configurado");
}

interface MetaAppCredentials {
  appId: string;
  appSecret: string;
}

// Credenciais por conexão ficam em cache (Redis/memória) durante o fluxo OAuth.
// O secret nunca trafega na URL nem no state — só a chave aleatória `ck`.
const OAUTH_CREDS_PREFIX = "meta-oauth-creds:";
const OAUTH_CREDS_TTL_SECONDS = 30 * 60; // mesmo TTL do state

export const stashOAuthCreds = async (credsKey: string, creds: MetaAppCredentials): Promise<void> => {
  await cacheLayer.set(OAUTH_CREDS_PREFIX + credsKey, JSON.stringify(creds), "EX", OAUTH_CREDS_TTL_SECONDS);
};

// Consome as credenciais (one-shot): remove do cache após leitura
export const resolveOAuthCreds = async (credsKey: string): Promise<MetaAppCredentials | null> => {
  const raw = await cacheLayer.get(OAUTH_CREDS_PREFIX + credsKey);
  if (!raw) return null;
  await cacheLayer.del(OAUTH_CREDS_PREFIX + credsKey);
  try {
    return JSON.parse(raw) as MetaAppCredentials;
  } catch {
    return null;
  }
};

// ponytail: state is HMAC-signed JSON {companyId, channel, nonce, exp, ck?}
export const createOAuthState = (companyId: number, channel: string, credsKey?: string): string => {
  const payload = JSON.stringify({ companyId, channel, nonce: crypto.randomBytes(8).toString("hex"), exp: Date.now() + 30 * 60 * 1000, ...(credsKey ? { ck: credsKey } : {}) });
  const sig = crypto.createHmac("sha256", META_STATE_SECRET).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
};

export const verifyOAuthState = (state: string): { companyId: number; channel: string; ck?: string } | null => {
  try {
    const { payload, sig } = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    const expected = crypto.createHmac("sha256", META_STATE_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return null;
    return { companyId: data.companyId, channel: data.channel, ck: data.ck };
  } catch {
    return null;
  }
};

export const buildOAuthUrl = (companyId: number, channel: "facebook" | "instagram", appId: string, credsKey?: string): string => {
  const redirectUri = `${process.env.BACKEND_URL}/meta-oauth/callback`;
  const state = createOAuthState(companyId, channel, credsKey);
  // pages_manage_metadata e obrigatorio para POST /{page-id}/subscribed_apps
  const scope = channel === "instagram"
    ? "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata"
    : "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata";
  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;
};

// Exchange short-lived code for long-lived page access token and discover pages
export const exchangeCodeForPages = async (code: string, channel: string, appId: string, appSecret: string): Promise<{
  userId: string;
  userToken: string;
  pages: Array<{
    pageId: string;
    pageName: string;
    pageToken: string;
    instagramAccountId?: string;
  }>;
}> => {
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

  // Step 2b: identidade do usuário autorizante (referência/auditoria)
  const { data: meData } = await axios.get(`${GRAPH}/me`, {
    params: { access_token: longToken, fields: "id" }
  });
  const userId = meData.id;

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
  return { userId, userToken: longToken, pages: result };
};

// Subscribe app to page webhook
export const subscribePageWebhook = async (
  pageId: string,
  pageToken: string,
  channel: string = "facebook"
): Promise<void> => {
  // subscribed_apps da Page só aceita campos de Page — os campos
  // exclusivos de Instagram (comments, mentions, messaging_seen) são
  // assinados no objeto "Instagram" do webhook do app, não aqui.
  const fields =
    channel === "instagram"
      ? "messages,messaging_postbacks"
      // standby + messaging_handovers: sem eles, quando outro app (ex.: Caixa
      // de Entrada da Meta) é o receptor primário da página, as mensagens não
      // chegam em 'messaging' nem em 'standby' — a página fica sem receber DMs
      : "messages,messaging_postbacks,message_deliveries,message_reads,feed,messaging_referrals,standby,messaging_handovers";

  const subscribe = (subscribedFields: string) =>
    axios.post(`${GRAPH}/${pageId}/subscribed_apps`, null, {
      params: { access_token: pageToken, subscribed_fields: subscribedFields }
    });

  try {
    await subscribe(fields);
  } catch (err: any) {
    const metaErr = err?.response?.data?.error;
    logger.warn(
      `[MetaOAuth] subscribePageWebhook failed for ${pageId}: ${err.message} ` +
      `(meta=${JSON.stringify(metaErr ?? null)})`
    );
    // Fallback: se algum campo não for suportado pela página, assina só o
    // essencial para não ficar sem receber DMs.
    try {
      // Fallback mantém standby — essencial quando o app não é o receptor primário
      await subscribe("messages,messaging_postbacks,standby,messaging_handovers");
      logger.info(`[MetaOAuth] subscribePageWebhook fallback ok p/ ${pageId}`);
    } catch (err2: any) {
      logger.warn(
        `[MetaOAuth] subscribePageWebhook fallback falhou p/ ${pageId}: ` +
        `${JSON.stringify(err2?.response?.data?.error ?? err2?.message)}`
      );
      // Último nível: assinatura mínima para não ficar sem receber nada
      try {
        await subscribe("messages,messaging_postbacks");
        logger.info(`[MetaOAuth] subscribePageWebhook fallback mínimo ok p/ ${pageId}`);
      } catch (err3: any) {
        logger.warn(
          `[MetaOAuth] subscribePageWebhook fallback mínimo falhou p/ ${pageId}: ` +
          `${JSON.stringify(err3?.response?.data?.error ?? err3?.message)}`
        );
      }
    }
  }
};

// ============================================================================
// Seleção granular de páginas/contas pós-OAuth
// ============================================================================
// Após o callback OAuth, as páginas/contas IG descobertas ficam em stash no
// cache (tokens inclusos, apenas server-side) até o usuário escolher quais
// conectar. O stash NUNCA é exposto em respostas HTTP com tokens.
const META_SELECTION_PREFIX = "meta-oauth-sel:";
const META_SELECTION_TTL_SECONDS = 20 * 60; // 20 minutos

export interface MetaSelectionPage {
  pageId: string;
  pageName: string;
  pageToken: string;
  instagramAccountId?: string;
}

export interface MetaSelectionData {
  companyId: number;
  channel: string;
  userId: string;
  userToken: string;
  appId: string;
  appSecret: string;
  customCreds: boolean;
  pages: MetaSelectionPage[];
}

// Gera a chave aleatória do stash (vai na querystring do redirect p/ frontend)
export const generateMetaSelectionKey = (): string =>
  crypto.randomBytes(16).toString("hex");

export const stashMetaSelection = async (
  key: string,
  data: MetaSelectionData,
  ttlSeconds: number = META_SELECTION_TTL_SECONDS
): Promise<void> => {
  await cacheLayer.set(META_SELECTION_PREFIX + key, JSON.stringify(data), "EX", ttlSeconds);
};

// Lê sem consumir — usado pelo GET de listagem (usuário pode recarregar a tela)
export const getMetaSelection = async (key: string): Promise<MetaSelectionData | null> => {
  const raw = await cacheLayer.get(META_SELECTION_PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MetaSelectionData;
  } catch {
    return null;
  }
};

// Lê e deleta — usado na confirmação (POST) para invalidar o stash após uso
export const consumeMetaSelection = async (key: string): Promise<MetaSelectionData | null> => {
  const raw = await cacheLayer.get(META_SELECTION_PREFIX + key);
  if (!raw) return null;
  await cacheLayer.del(META_SELECTION_PREFIX + key);
  try {
    return JSON.parse(raw) as MetaSelectionData;
  } catch {
    return null;
  }
};
