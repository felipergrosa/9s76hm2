import { Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  buildOAuthUrl,
  verifyOAuthState,
  exchangeCodeForPages,
  subscribePageWebhook,
  stashOAuthCreds,
  resolveOAuthCreds,
  stashMetaSelection,
  getMetaSelection,
  consumeMetaSelection,
  generateMetaSelectionKey,
  MetaSelectionData,
  MetaSelectionPage
} from "../services/MetaOAuthService";
import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import { emitToCompanyNamespace } from "../libs/socketEmit";
import { invalidateCache, cacheKey } from "../helpers/queryCache";
import { sanitizeWhatsapp } from "../helpers/sanitizeWhatsapp";

const META_CREDENTIALS_ERROR =
  "Credenciais do App Meta não configuradas. Preencha Meta App ID e Meta App Secret nos campos da conexão ou configure META_APP_ID/META_APP_SECRET no servidor.";

const META_SELECTION_EXPIRED_ERROR =
  "A seleção de páginas expirou ou não existe. Inicie a conexão novamente.";

// Chave da conexão usada por webhook/factory:
// facebook → Page ID; instagram → Instagram Business Account ID
const selectionKeyOf = (channel: string, page: MetaSelectionPage): string | undefined =>
  channel === "instagram" ? page.instagramAccountId : page.pageId;

// Cria ou atualiza a conexão de uma página/conta selecionada (mesma regra que
// o callback usava para todas as páginas). Re-autorização atualiza tokens em
// vez de duplicar a conexão.
const upsertConnectionFromPage = async (
  stash: MetaSelectionData,
  page: MetaSelectionPage
): Promise<"created" | "updated" | "skipped"> => {
  const connectionKey = selectionKeyOf(stash.channel, page);
  if (!connectionKey) {
    logger.warn(`[MetaOAuth] página ${page.pageId} sem chave de conexão para channel=${stash.channel}, ignorada`);
    return "skipped";
  }

  await subscribePageWebhook(page.pageId, page.pageToken, stash.channel, page.instagramAccountId);

  const connectionData = {
    name: `${page.pageName} (${stash.channel === "instagram" ? "Instagram" : "Facebook"})`,
    channel: stash.channel,
    channelType: stash.channel,
    companyId: stash.companyId,
    status: "CONNECTED",
    facebookUserId: stash.userId,
    facebookPageUserId: connectionKey,
    facebookUserToken: page.pageToken,
    tokenMeta: stash.userToken,
    metaPageId: page.pageId,
    metaPageAccessToken: page.pageToken,
    // Persiste credenciais do app apenas quando vieram da conexão (custom),
    // não duplicando o secret global de env no banco
    ...(stash.customCreds ? { metaAppId: stash.appId, metaAppSecret: stash.appSecret } : {}),
    ...(page.instagramAccountId ? { instagramAccountId: page.instagramAccountId } : {})
  };

  const existing = await Whatsapp.findOne({
    where: {
      companyId: stash.companyId,
      facebookPageUserId: connectionKey,
      channel: stash.channel
    }
  });

  if (existing) {
    await existing.update(connectionData);
    await notifyConnectionChange(stash.companyId, existing);
    return "updated";
  }

  const { whatsapp } = await CreateWhatsAppService(connectionData as any);
  await notifyConnectionChange(stash.companyId, whatsapp);
  return "created";
};

// Notifica o frontend (mesmo evento do CRUD de conexões) e invalida o
// query cache da listagem — sem isso /whatsapp retornava a lista stale
// por até 60s e a conexão nova não aparecia na tela.
const notifyConnectionChange = async (
  companyId: number,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    await invalidateCache(cacheKey("whatsapps", companyId));
    await emitToCompanyNamespace(companyId, `company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    });
  } catch (err: any) {
    logger.warn(`[MetaOAuth] Falha ao notificar conexão ${whatsapp.id}: ${err.message}`);
  }
};

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

    // Não cria conexões aqui: as páginas/contas descobertas vão para stash
    // (server-side, com tokens) e o usuário escolhe no frontend quais conectar.
    // O stash expira em 20min — a key vai na querystring do redirect.
    const selectionKey = generateMetaSelectionKey();
    await stashMetaSelection(selectionKey, {
      companyId: stateData.companyId,
      channel: stateData.channel,
      userId,
      userToken,
      appId,
      appSecret,
      customCreds,
      pages
    });

    logger.info(`[MetaOAuth] companyId=${stateData.companyId} channel=${stateData.channel} ${pages.length} página(s)/conta(s) aguardando seleção`);
    res.redirect(`${frontendUrl}/connections?meta_select=${selectionKey}`);
  } catch (err: any) {
    logger.error(`[MetaOAuth] callback error: ${err.message}`);
    res.redirect(`${frontendUrl}/connections?meta_error=${encodeURIComponent(err.message)}`);
  }
};

// GET /meta-oauth/selection/:key — lista páginas/contas descobertas no OAuth
// para o usuário escolher quais conectar. NUNCA expõe tokens na resposta.
export const showMetaSelection = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { key } = req.params;

  const stash = await getMetaSelection(key || "");
  if (!stash) {
    return res.status(410).json({ error: META_SELECTION_EXPIRED_ERROR });
  }
  if (stash.companyId !== companyId) {
    return res.status(403).json({ error: "Esta seleção não pertence à sua empresa." });
  }

  // Uma única query para marcar o que já está conectado (evita N+1)
  const connectionKeys = stash.pages
    .map(p => selectionKeyOf(stash.channel, p))
    .filter((k): k is string => Boolean(k));

  const existing = await Whatsapp.findAll({
    where: {
      companyId,
      channel: stash.channel,
      facebookPageUserId: { [Op.in]: connectionKeys }
    },
    attributes: ["facebookPageUserId"]
  });
  const connectedKeys = new Set(existing.map(e => e.facebookPageUserId));

  return res.json({
    channel: stash.channel,
    pages: stash.pages.map(p => {
      const connectionKey = selectionKeyOf(stash.channel, p);
      return {
        key: connectionKey || null,
        pageId: p.pageId,
        pageName: p.pageName,
        instagramAccountId: p.instagramAccountId || null,
        alreadyConnected: connectionKey ? connectedKeys.has(connectionKey) : false
      };
    })
  });
};

// POST /meta-oauth/selection/:key { selectedKeys: string[] }
// Confirma a seleção granular: cria/atualiza apenas as conexões escolhidas
// e consome o stash (não permite reuso).
export const confirmMetaSelection = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { key } = req.params;
  const selectedKeys = (req.body || {}).selectedKeys;

  if (
    !Array.isArray(selectedKeys) ||
    selectedKeys.length === 0 ||
    !selectedKeys.every((k: any) => typeof k === "string" && k.length > 0)
  ) {
    return res.status(400).json({ error: "selectedKeys deve ser uma lista não vazia de identificadores." });
  }

  const stash = await getMetaSelection(key || "");
  if (!stash) {
    return res.status(410).json({ error: META_SELECTION_EXPIRED_ERROR });
  }
  if (stash.companyId !== companyId) {
    return res.status(403).json({ error: "Esta seleção não pertence à sua empresa." });
  }

  // Rejeita keys que não pertencem ao stash — impede vincular páginas de
  // outra autorização/empresa via IDOR no body
  const validKeys = new Set(
    stash.pages
      .map(p => selectionKeyOf(stash.channel, p))
      .filter((k): k is string => Boolean(k))
  );
  const invalidKeys = selectedKeys.filter((k: string) => !validKeys.has(k));
  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: "Uma ou mais contas selecionadas não pertencem a esta autorização." });
  }

  let created = 0;
  let updated = 0;
  const selected = new Set(selectedKeys);

  for (const page of stash.pages) {
    const connectionKey = selectionKeyOf(stash.channel, page);
    if (!connectionKey || !selected.has(connectionKey)) continue;

    const result = await upsertConnectionFromPage(stash, page);
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  // Consome o stash somente após processar — em caso de erro o usuário pode
  // reenviar a seleção dentro do TTL de 20min
  await consumeMetaSelection(key);

  logger.info(`[MetaOAuth] companyId=${companyId} channel=${stash.channel} seleção confirmada: created=${created} updated=${updated}`);
  return res.json({ created, updated });
};
