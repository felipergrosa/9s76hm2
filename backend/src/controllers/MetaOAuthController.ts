import { Request, Response } from "express";
import { buildOAuthUrl, verifyOAuthState, exchangeCodeForPages, subscribePageWebhook } from "../services/MetaOAuthService";
import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import logger from "../utils/logger";

// GET /meta-oauth/start?channel=facebook|instagram — generates Meta OAuth URL
export const startOAuth = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const channel = (req.query.channel as string) || "facebook";
  if (!["facebook", "instagram"].includes(channel)) {
    return res.status(400).json({ error: "channel deve ser facebook ou instagram" });
  }
  const metaAppId = process.env.META_APP_ID;
  if (!metaAppId) {
    return res.status(503).json({ error: "META_APP_ID não configurado no servidor" });
  }
  const url = buildOAuthUrl(companyId, channel as "facebook" | "instagram");
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
    const pages = await exchangeCodeForPages(code, stateData.channel);
    const created = [];

    for (const page of pages) {
      await subscribePageWebhook(page.pageId, page.pageToken);
      const whatsapp = await CreateWhatsAppService({
        name: `${page.pageName} (${stateData.channel === "instagram" ? "Instagram" : "Facebook"})`,
        channel: stateData.channel,
        companyId: stateData.companyId,
        facebookUserId: page.pageId,
        facebookUserToken: page.pageToken,
        metaPageId: page.pageId,
        metaPageAccessToken: page.pageToken,
        ...(page.instagramAccountId ? { instagramAccountId: page.instagramAccountId } : {})
      } as any);
      created.push((whatsapp as any).id);
    }

    logger.info(`[MetaOAuth] companyId=${stateData.companyId} channel=${stateData.channel} created ${created.length} connections`);
    res.redirect(`${frontendUrl}/connections?meta_success=${created.length}`);
  } catch (err: any) {
    logger.error(`[MetaOAuth] callback error: ${err.message}`);
    res.redirect(`${frontendUrl}/connections?meta_error=${encodeURIComponent(err.message)}`);
  }
};
