import { Request, Response } from "express";
import axios from "axios";
import { getIO } from "../libs/socket";
import { emitToCompanyNamespace } from "../libs/socketEmit";
import cacheLayer from "../libs/cache";
import { removeWbot, restartWbot } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import { getAccessTokenFromPage, getPageProfile, subscribeApp } from "../services/FacebookServices/graphAPI";
import { subscribePageWebhook } from "../services/MetaOAuthService";
import ShowPlanService from "../services/PlanService/ShowPlanService";
import { StartWhatsAppSessionUnified } from "../services/WbotServices/StartWhatsAppSessionUnified";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { closeTicketsImported } from "../services/WhatsappService/ImportWhatsAppMessageService";
import SyncFullHistoryService, { getSyncProgress } from "../services/MessageServices/SyncFullHistoryService";
import ShowWhatsAppServiceAdmin from "../services/WhatsappService/ShowWhatsAppServiceAdmin";
import UpdateWhatsAppServiceAdmin from "../services/WhatsappService/UpdateWhatsAppServiceAdmin";
import ListAllWhatsAppsService from "../services/WhatsappService/ListAllWhatsAppService";
import ListFilterWhatsAppsService from "../services/WhatsappService/ListFilterWhatsAppsService";
import User from "../models/User";
import { sanitizeWhatsapp } from "../helpers/sanitizeWhatsapp";
import logger from "../utils/logger";

interface WhatsappData {
  name: string;
  queueIds: number[];
  companyId: number;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  maxUseBotQueues?: string;
  timeUseBotQueues?: string;
  expiresTicket?: number;
  allowGroup?: false;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
  ratingMessage?: string;
  maxUseBotQueuesNPS?: number;
  expiresTicketNPS?: number;
  whenExpiresTicket?: string;
  expiresInactiveMessage?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  groupAsTicket?: string;
  timeCreateNewTicket?: number;
  schedules?: any[];
  promptId?: number;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
  flowIdNotPhrase?: number;
  flowIdWelcome?: number;
  channelType?: string;
  wabaPhoneNumberId?: string;
  wabaAccessToken?: string;
  wabaBusinessAccountId?: string;
  wabaWebhookVerifyToken?: string;
  contactTagId?: number;
  color?: string;
}

interface QueryParams {
  session?: number | string;
  channel?: string;
}

import { Op } from "sequelize";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.user;
  const { session } = req.query as QueryParams;

  let whatsapps = await ListWhatsAppsService({ companyId, session });
  const user = await User.findByPk(id);

  // Filtro de Conexões: Super Admin vê tudo, demais respeitam allowedConnectionIds
  if (user && !user.super) {
    const allowedIds = user.allowedConnectionIds || [];
    if (allowedIds.length > 0) {
      whatsapps = whatsapps.filter(w => allowedIds.includes(w.id));
    }
  }

  return res.status(200).json(whatsapps.map(sanitizeWhatsapp));
};

export const indexFilter = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session, channel } = req.query as QueryParams;

  const whatsapps = await ListFilterWhatsAppsService({ companyId, session, channel });

  return res.status(200).json(whatsapps.map(sanitizeWhatsapp));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    token,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    flowIdNotPhrase,
    flowIdWelcome,
    channelType,
    wabaPhoneNumberId,
    wabaAccessToken,
    wabaBusinessAccountId,
    wabaWebhookVerifyToken,
    contactTagId,
    color
  }: WhatsappData = req.body;
  const { companyId } = req.user;

  const company = await ShowCompanyService(companyId)
  const plan = await ShowPlanService(company.planId);

  if (!plan.useWhatsapp) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  // logs de debug removidos

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    companyId,
    token,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    flowIdNotPhrase,
    flowIdWelcome,
    channelType,
    wabaPhoneNumberId,
    wabaAccessToken,
    wabaBusinessAccountId,
    wabaWebhookVerifyToken,
    contactTagId,
    color
  });

  StartWhatsAppSessionUnified(whatsapp, companyId);

  const io = getIO();
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-whatsapp`,
    {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    }
  );

  if (oldDefaultWhatsapp) {
    await emitToCompanyNamespace(
      companyId,
      `company-${companyId}-whatsapp`,
      {
        action: "update",
        whatsapp: sanitizeWhatsapp(oldDefaultWhatsapp)
      }
    );
  }

  return res.status(200).json(sanitizeWhatsapp(whatsapp));

};

export const storeFacebook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      facebookUserId,
      facebookUserToken,
      addInstagram
    }: {
      facebookUserId: string;
      facebookUserToken: string;
      addInstagram: boolean;
    } = req.body;
    const { companyId } = req.user;

    // const company = await ShowCompanyService(companyId)
    // const plan = await ShowPlanService(company.planId);

    // if (!plan.useFacebook) {
    //   return res.status(400).json({
    //     error: "Você não possui permissão para acessar este recurso!"
    //   });
    // }

    const { data } = await getPageProfile(facebookUserId, facebookUserToken);

    if (data.length === 0) {
      return res.status(400).json({
        error: "Facebook page not found"
      });
    }
    const io = getIO();

    const pages = [];
    for await (const page of data) {
      const { name, access_token, id, instagram_business_account } = page;

      const acessTokenPage = await getAccessTokenFromPage(access_token);

      if (instagram_business_account && addInstagram) {
        const { id: instagramId, username, name: instagramName } = instagram_business_account;

        pages.push({
          companyId,
          name: `Insta ${username || instagramName}`,
          facebookUserId: facebookUserId,
          facebookPageUserId: instagramId,
          facebookUserToken: acessTokenPage,
          tokenMeta: facebookUserToken,
          isDefault: false,
          channel: "instagram",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        pages.push({
          companyId,
          name,
          facebookUserId: facebookUserId,
          facebookPageUserId: id,
          facebookUserToken: acessTokenPage,
          tokenMeta: facebookUserToken,
          isDefault: false,
          channel: "facebook",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        await subscribeApp(id, acessTokenPage);
      }

      if (!instagram_business_account) {
        pages.push({
          companyId,
          name,
          facebookUserId: facebookUserId,
          facebookPageUserId: id,
          facebookUserToken: acessTokenPage,
          tokenMeta: facebookUserToken,
          isDefault: false,
          channel: "facebook",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        await subscribeApp(page.id, acessTokenPage);
      }

    }

    for await (const pageConection of pages) {

      const exist = await Whatsapp.findOne({
        where: {
          facebookPageUserId: pageConection.facebookPageUserId
        }
      });

      if (exist) {
        await exist.update({
          ...pageConection
        });
      }

      if (!exist) {
        const { whatsapp } = await CreateWhatsAppService(pageConection);

        await emitToCompanyNamespace(
          companyId,
          `company-${companyId}-whatsapp`,
          {
            action: "update",
            whatsapp: sanitizeWhatsapp(whatsapp)
          }
        );

      }
    }
    return res.status(200).json({ message: "Facebook pages connected." });
  } catch (error: any) {
    // Log sanitizado: error.config carrega access_token na URL/params — nunca logar
    logger.error(
      `[storeFacebook] ${error?.message || error} ` +
      `(status=${error?.response?.status ?? "n/a"}, meta=${JSON.stringify(error?.response?.data?.error ?? null)})`
    );
    return res.status(400).json({
      error: "Facebook page not found"
    });
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { session } = req.query;

  // console.log("SHOWING WHATSAPP", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId, session);


  return res.status(200).json(sanitizeWhatsapp(whatsapp));
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    });

  if (oldDefaultWhatsapp) {
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-whatsapp`, {
        action: "update",
        whatsapp: sanitizeWhatsapp(oldDefaultWhatsapp)
      });
  }

  return res.status(200).json(sanitizeWhatsapp(whatsapp));

};

export const closedTickets = async (req: Request, res: Response) => {
  const { whatsappId } = req.params
  const { companyId } = req.user;

  // Confirma que a conexão pertence à empresa antes de fechar tickets importados
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id"]
  });
  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  closeTicketsImported(whatsappId)

  return res.status(200).json("whatsapp");

}

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile } = req.user;
  const io = getIO();

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  // log de debug removido
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);


  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    await emitToCompanyNamespace(
      companyId,
      `company-${companyId}-whatsapp`,
      {
        action: "delete",
        whatsappId: +whatsappId
      }
    );

  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;

    // companyId no where: token de outra empresa não pode ser afetado
    const getAllSameToken = await Whatsapp.findAll({
      where: {
        facebookUserToken,
        companyId
      }
    });

    await Whatsapp.destroy({
      where: {
        facebookUserToken,
        companyId
      }
    });

    for await (const whatsapp of getAllSameToken) {
      await emitToCompanyNamespace(
        companyId,
        `company-${companyId}-whatsapp`,
        {
          action: "delete",
          whatsappId: whatsapp.id
        }
      );
    }

  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile, id } = req.user;

  const user = await User.findByPk(id);
  const { allowConnections } = user;

  if (profile !== "admin" && allowConnections === "disabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await restartWbot(companyId);

  return res.status(200).json({ message: "Whatsapp restart." });
};

export const listAll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  // Super admin pode listar conexões de todas as empresas;
  // demais usuários ficam restritos à própria empresa.
  const isSuper = Boolean((req.user as any)?.super);
  const whatsapps = await ListAllWhatsAppsService({
    session,
    companyId: isSuper ? undefined : companyId
  });
  return res.status(200).json(whatsapps.map(sanitizeWhatsapp));
};

export const updateAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppServiceAdmin({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`admin-whatsapp`, {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    });

  if (oldDefaultWhatsapp) {
    io.of(`/workspace-${companyId}`)
      .emit(`admin-whatsapp`, {
        action: "update",
        whatsapp: sanitizeWhatsapp(oldDefaultWhatsapp)
      });
  }

  return res.status(200).json(sanitizeWhatsapp(whatsapp));
};

export const removeAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const io = getIO();
  console.log("REMOVING WHATSAPP ADMIN", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);


  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    io.of(`/workspace-${companyId}`)
      .emit(`admin-whatsapp`, {
        action: "delete",
        whatsappId: +whatsappId
      });

  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;

    // companyId no where: token de outra empresa não pode ser afetado
    const getAllSameToken = await Whatsapp.findAll({

      where: {
        facebookUserToken,
        companyId
      }
    });

    await Whatsapp.destroy({
      where: {
        facebookUserToken,
        companyId
      }
    });

    for await (const whatsapp of getAllSameToken) {
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-whatsapp`, {
          action: "delete",
          whatsappId: whatsapp.id
        });
    }

  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const showAdmin = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  // console.log("SHOWING WHATSAPP ADMIN", whatsappId)
  const whatsapp = await ShowWhatsAppServiceAdmin(whatsappId, companyId);


  return res.status(200).json(sanitizeWhatsapp(whatsapp));
};

/**
 * Inicia sincronização completa de histórico de forma organizada
 * POST /whatsapp/:whatsappId/sync-full-history
 */
export const syncFullHistory = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { periodMonths = 0, downloadMedia = false } = req.body;

  const result = await SyncFullHistoryService({
    whatsappId: Number(whatsappId),
    companyId,
    periodMonths: Number(periodMonths),
    downloadMedia: Boolean(downloadMedia)
  });

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.status(200).json({
    message: result.message,
    totalTickets: result.totalTickets
  });
};

/**
 * Retorna progresso da sincronização
 * GET /whatsapp/:whatsappId/sync-progress
 */
export const getSyncProgressStatus = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  // Escopo por empresa: progresso de sync de outra empresa não vaza
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id"]
  });
  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const progress = getSyncProgress(Number(whatsappId));

  if (!progress) {
    return res.status(200).json({ 
      status: "idle",
      message: "Nenhuma sincronização em andamento"
    });
  }

  return res.status(200).json(progress);
};

/**
 * Diagnóstico de conexões Meta (Facebook/Instagram):
 * - token da página válido?
 * - o app está assinado na página (subscribed_apps) e com quais campos?
 * Ajuda a detectar webhook desconfigurado no painel da Meta.
 * GET /whatsapp/:whatsappId/meta-health
 */
export const metaHealth = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: [
      "id", "name", "channel", "channelType",
      "metaPageId", "metaPageAccessToken",
      "facebookUserToken", "facebookPageUserId", "instagramAccountId",
      "status", "updatedAt"
    ]
  });
  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const channel = whatsapp.channel || whatsapp.channelType;
  if (channel !== "facebook" && channel !== "instagram") {
    return res.status(400).json({ error: "Diagnóstico disponível apenas para conexões Facebook/Instagram" });
  }

  const pageId = whatsapp.metaPageId || whatsapp.facebookPageUserId;
  const token = whatsapp.metaPageAccessToken || whatsapp.facebookUserToken;

  const result: any = {
    channel,
    pageId,
    instagramAccountId: whatsapp.instagramAccountId || null,
    tokenValid: false,
    subscribed: false,
    subscribedFields: [] as string[],
    hints: [] as string[]
  };

  if (!token) {
    result.hints.push("Token da página ausente — refaça a conexão via OAuth.");
    return res.status(200).json(result);
  }

  // Valida token e traz subscribed_apps numa única chamada
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
      params: {
        access_token: token,
        fields: "id,name,subscribed_apps{subscribed_fields}"
      },
      timeout: 15000
    });
    result.tokenValid = true;
    result.pageName = data.name;
    const myAppId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;
    const apps = data?.subscribed_apps?.data || [];
    const mine = myAppId ? apps.filter((a: any) => String(a.id) === String(myAppId)) : apps;
    const fields = new Set<string>();
    mine.forEach((a: any) => (a.subscribed_fields || []).forEach((f: string) => fields.add(f)));
    result.subscribedApps = apps.map((a: any) => ({ id: a.id, fields: a.subscribed_fields || [] }));
    result.subscribedFields = [...fields];
    result.subscribed = fields.has("messages");
  } catch (err: any) {
    const metaErr = err?.response?.data?.error;
    result.tokenError = metaErr?.message || err.message;
    result.tokenErrorCode = metaErr?.code;
  }

  // Dicas acionáveis conforme o diagnóstico
  if (!result.tokenValid) {
    result.hints.push("Token inválido/expirado — refaça a conexão via OAuth (botão editar → reconectar).");
  } else if (!result.subscribed) {
    result.hints.push("Página sem assinatura 'messages' neste app — refaça a conexão ou assine no painel da Meta.");
  }
  if (channel === "facebook") {
    result.hints.push(
      "Confira no app Meta → Webhooks → objeto 'Página' se o callback está assinado com o campo 'messages'. " +
      "Se a página usa Caixa de Entrada da Meta como principal, o handover pode estar ativo — mensagens chegam em 'standby'."
    );
  }
  if (channel === "instagram") {
    result.hints.push("Confira no app Meta → Webhooks → objeto 'Instagram' se 'messages' está assinado.");
  }

  return res.status(200).json(result);
};

/**
 * Re-executa a assinatura webhook da página (POST /{page-id}/subscribed_apps)
 * e devolve o estado atualizado. Auto-cura para conexões Meta cuja
 * subscribed_apps falhou/expirou sem refazer o OAuth.
 * POST /whatsapp/:whatsappId/meta-resubscribe
 */
export const metaResubscribe = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: [
      "id", "name", "channel", "channelType",
      "metaPageId", "metaPageAccessToken",
      "facebookUserToken", "facebookPageUserId"
    ]
  });
  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const channel = whatsapp.channel || whatsapp.channelType;
  if (channel !== "facebook" && channel !== "instagram") {
    return res.status(400).json({ error: "Reassinatura disponível apenas para conexões Facebook/Instagram" });
  }

  const pageId = whatsapp.metaPageId || whatsapp.facebookPageUserId;
  const token = whatsapp.metaPageAccessToken || whatsapp.facebookUserToken;
  if (!pageId || !token) {
    return res.status(400).json({ error: "Conexão sem pageId/token — refaça via OAuth." });
  }

  await subscribePageWebhook(pageId, token, channel);
  logger.info(`[metaResubscribe] companyId=${companyId} whatsappId=${whatsappId} pageId=${pageId} channel=${channel}`);

  // Retorna o estado pós-assinatura (mesma consulta do meta-health)
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
      params: { access_token: token, fields: "id,name,subscribed_apps{subscribed_fields}" },
      timeout: 15000
    });
    const apps = data?.subscribed_apps?.data || [];
    const myAppId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;
    const mine = myAppId ? apps.filter((a: any) => String(a.id) === String(myAppId)) : apps;
    const fields = new Set<string>();
    mine.forEach((a: any) => (a.subscribed_fields || []).forEach((f: string) => fields.add(f)));
    return res.status(200).json({
      success: true,
      pageId,
      pageName: data.name,
      subscribed: fields.has("messages"),
      subscribedFields: [...fields]
    });
  } catch (err: any) {
    const metaErr = err?.response?.data?.error;
    return res.status(200).json({
      success: false,
      pageId,
      subscribed: false,
      error: metaErr?.message || err.message
    });
  }
};

