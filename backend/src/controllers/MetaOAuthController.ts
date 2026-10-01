import { Request, Response } from "express";
import crypto from "crypto";
import { buildOAuthUrl, verifyOAuthState, exchangeCodeForPages, subscribePageWebhook, stashOAuthCreds, resolveOAuthCreds } from "../services/MetaOAuthService";
import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";

const META_CREDENTIALS_ERROR =
  "Credenciais do App Meta não configuradas. Preencha Meta App ID e Meta App Secret nos campos da conexão ou configure META_APP_ID/META_APP_SECRET no servidor.";

// POST /meta-oauth/start {channel, whatsappId?, metaAppId?, metaAppSecret?}
// Gera a URL de OAuth da Meta. Resolução de credenciais (ordem):
//   1. metaAppId/metaAppSecret enviados no body (conexão nova ainda não salva)
//   2. Credenciais da conexão salva (whatsappId, restrita ao tenant)
//   3. Variáveis de ambiente META_APP_ID/META_APP_SECRET (fallback global)
// O secret nunca vai na URL/state — fica em stash no cache ligado ao state via `ck`.
export const startOAuth = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const body = (req.method === "POST" ? req.body : req.query) || {};
  const channel = (body.channel as string) || "facebook";
  if (!["facebook", "instagram"].includes(channel)) {
    return res.status(400).json({ error: "channel deve ser facebook ou instagram" });
  }

  let appId = (body.metaAppId as string) || "";
  let appSecret = (body.metaAppSecret as string) || "";

  // Credenciais de uma conexão já salva (edição) — valida posse do tenant
  if (!appId && body.whatsappId) {
    const connection = await Whatsapp.findOne({
      where: { id: Number(body.whatsappId), companyId },
      attributes: ["id", "metaAppId", "metaAppSecret"]
    });
    if (connection?.metaAppId) {
      appId = connection.metaAppId;
      appSecret = connection.metaAppSecret || "";
    }
  }

  // Fallback global do servidor
  if (!appId) {
    appId = process.env.META_APP_ID || "";
    appSecret = process.env.META_APP_SECRET || "";
  }

  if (!appId || !appSecret) {
    return res.status(503).json({ error: META_CREDENTIALS_ERROR });
  }

  // Quando credenciais não são as de env, guardamos em stash e referenciamos no state
  let credsKey: string | undefined;
  const usingEnv = appId === (process.env.META_APP_ID || "") && appSecret === (process.env.META_APP_SECRET || "");
  if (!usingEnv) {
    credsKey = crypto.randomBytes(16).toString("hex");
    await stashOAuthCreds(credsKey, { appId, appSecret });
  }

  const url = buildOAuthUrl(companyId, channel as "facebook" | "instagram", appId, credsKey);
  return res.json({ url });
};

// GET /meta-oauth/callback — called by Meta after user authorizes
export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as any;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (oauthError) {
    res.redirect(`${frontendUrl}/connections?meta_error=${encodeURIComponent(oauthError)}`);
    return;
  }

  const stateData = verifyOAuthState(state || "");
  if (!stateData) {
    res.redirect(`${frontendUrl}/connections?meta_error=invalid_state`);
    return;
  }

  try {
    // Credenciais por conexão ficam em stash (one-shot); sem ck usa env global
    let appId = process.env.META_APP_ID || "";
    let appSecret = process.env.META_APP_SECRET || "";
    let customCreds = false;
    if (stateData.ck) {
      const creds = await resolveOAuthCreds(stateData.ck);
      if (!creds) {
        res.redirect(`${frontendUrl}/connections?meta_error=${encodeURIComponent("Sessão de autorização expirada. Tente conectar novamente.")}`);
        return;
      }
      appId = creds.appId;
      appSecret = creds.appSecret;
      customCreds = true;
    }

    const { userId, userToken, pages } = await exchangeCodeForPages(code, stateData.channel, appId, appSecret);
    const processed = [];

    for (const page of pages) {
      await subscribePageWebhook(page.pageId, page.pageToken);

      // facebookPageUserId é a chave usada por webhook/factory:
      // facebook → Page ID; instagram → Instagram Business Account ID
      const connectionKey = stateData.channel === "instagram"
        ? page.instagramAccountId
        : page.pageId;

      const connectionData = {
        name: `${page.pageName} (${stateData.channel === "instagram" ? "Instagram" : "Facebook"})`,
        channel: stateData.channel,
        channelType: stateData.channel,
        companyId: stateData.companyId,
        status: "CONNECTED",
        facebookUserId: userId,
        facebookPageUserId: connectionKey,
        facebookUserToken: page.pageToken,
        tokenMeta: userToken,
        metaPageId: page.pageId,
        metaPageAccessToken: page.pageToken,
        // Persiste credenciais do app apenas quando vieram da conexão (custom),
        // não duplicando o secret global de env no banco
        ...(customCreds ? { metaAppId: appId, metaAppSecret: appSecret } : {}),
        ...(page.instagramAccountId ? { instagramAccountId: page.instagramAccountId } : {})
      };

      // Re-autorização atualiza tokens em vez de duplicar a conexão
      const existing = await Whatsapp.findOne({
        where: {
          companyId: stateData.companyId,
          facebookPageUserId: connectionKey,
          channel: stateData.channel
        }
      });

      if (existing) {
        await existing.update(connectionData);
        processed.push(existing.id);
      } else {
        const { whatsapp } = await CreateWhatsAppService(connectionData as any);
        processed.push(whatsapp.id);
      }
    }

    logger.info(`[MetaOAuth] companyId=${stateData.companyId} channel=${stateData.channel} processed ${processed.length} connections`);
    res.redirect(`${frontendUrl}/connections?meta_success=${processed.length}`);
  } catch (err: any) {
    logger.error(`[MetaOAuth] callback error: ${err.message}`);
    res.redirect(`${frontendUrl}/connections?meta_error=${encodeURIComponent(err.message)}`);
  }
};
