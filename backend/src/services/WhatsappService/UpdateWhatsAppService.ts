import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import ShowWhatsAppService from "./ShowWhatsAppService";
import { serviceCache } from "../../utils/serviceCache";
import { resolveMetaChannelCredentials } from "./metaChannelCredentials";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  queueIds?: number[];
  token?: string;
  maxUseBotQueues?: number;
  timeUseBotQueues?: string;
  expiresTicket?: string;
  allowGroup?: boolean;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
  ratingMessage?: string;
  maxUseBotQueuesNPS?: number;
  expiresTicketNPS?: number;
  whenExpiresTicket?: string;
  expiresInactiveMessage?: string;
  groupAsTicket?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  timeCreateNewTicket?: number;
  integrationId?: number;
  schedules?: any[];
  promptId?: number;
  requestQR?: boolean;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
  flowIdNotPhrase?: number;
  flowIdWelcome?: number;
  channel?: string;
  channelType?: string;
  facebookUserId?: string;
  facebookUserToken?: string;
  facebookPageUserId?: string;
  tokenMeta?: string;
  // Campos Meta (Facebook/Instagram)
  metaAppId?: string;
  metaAppSecret?: string;
  metaAccessToken?: string;
  metaPageId?: string;
  metaPageAccessToken?: string;
  metaWebhookVerifyToken?: string;
  instagramAccountId?: string;
  contactTagId?: number;
  syncOnTicketOpen?: boolean;
  // Mensagem de renovação de janela 24h (API Oficial)
  sessionWindowRenewalMessage?: string;
  sessionWindowRenewalMinutes?: number;
  // Templates permitidos para API Oficial
  allowedTemplates?: string[];
  color?: string;
  // Plataforma do dispositivo (android/ios/web)
  devicePlatform?: "android" | "ios" | "web";
}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
  companyId: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean(),
    color: Yup.string()
      .nullable()
      .matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Cor da conexão inválida")
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds = [],
    token,
    maxUseBotQueues = 0,
    timeUseBotQueues = 0,
    expiresTicket = 0,
    allowGroup,
    timeSendQueue = 0,
    sendIdQueue = null,
    timeInactiveMessage = 0,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS = 0,
    whenExpiresTicket,
    expiresInactiveMessage,
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket = null,
    integrationId,
    schedules,
    promptId,
    requestQR = false,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    flowIdNotPhrase,
    flowIdWelcome,
    // Campos Meta (Facebook/Instagram)
    metaAppId,
    metaAppSecret,
    metaAccessToken,
    metaPageId,
    metaPageAccessToken,
    metaWebhookVerifyToken,
    channel,
    channelType,
    facebookUserId,
    facebookUserToken,
    facebookPageUserId,
    tokenMeta,
    instagramAccountId,
    contactTagId,
    syncOnTicketOpen,
    // Mensagem de renovação de janela 24h (API Oficial)
    sessionWindowRenewalMessage,
    sessionWindowRenewalMinutes,
    // Templates permitidos para API Oficial
    allowedTemplates,
    color,
    // Plataforma do dispositivo
    devicePlatform
  } = whatsappData;

  const normalizedColor = typeof color === "string" && color.trim()
    ? color.trim()
    : null;

  try {
    await schema.validate({ name, status, isDefault, color: normalizedColor });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: {
        isDefault: true,
        id: { [Op.not]: whatsappId },
        companyId
      }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }
  // console.log("GETTING WHATSAPP SHOW WHATSAPP 1", whatsappId, companyId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  // Guarda o token anterior para invalidar o cache do middleware tokenAuth
  const oldWhatsappToken = whatsapp.token;

  const finalColor = typeof color === "undefined"
    ? whatsapp.color
    : normalizedColor;

  // Modal grava credenciais Meta em campos meta*; webhook/factory leem
  // as colunas legadas — resolve a ponte antes de persistir
  const metaResolved = resolveMetaChannelCredentials({
    channel: channel || whatsapp.channel,
    channelType: channelType || whatsapp.channelType,
    facebookPageUserId: facebookPageUserId || whatsapp.facebookPageUserId,
    facebookUserToken: facebookUserToken || whatsapp.facebookUserToken,
    metaPageId,
    metaPageAccessToken,
    instagramAccountId
  });

  await whatsapp.update({
    name,
    status: metaResolved.status || status,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    isDefault,
    companyId,
    token,
    maxUseBotQueues: maxUseBotQueues || 0,
    timeUseBotQueues: timeUseBotQueues || 0,
    expiresTicket: expiresTicket || 0,
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
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket,
    integrationId,
    schedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    flowIdNotPhrase,
    flowIdWelcome,
    channel: channel || whatsapp.channel,
    channelType: channelType || whatsapp.channelType,
    facebookUserId: facebookUserId || whatsapp.facebookUserId,
    facebookUserToken: metaResolved.facebookUserToken || whatsapp.facebookUserToken,
    facebookPageUserId: metaResolved.facebookPageUserId || whatsapp.facebookPageUserId,
    tokenMeta: tokenMeta || whatsapp.tokenMeta,
    // Campos Meta (Facebook/Instagram)
    metaAppId,
    metaAppSecret,
    metaAccessToken,
    metaPageId,
    metaPageAccessToken,
    metaWebhookVerifyToken,
    instagramAccountId,
    contactTagId,
    syncOnTicketOpen,
    // Mensagem de renovação de janela 24h (API Oficial)
    sessionWindowRenewalMessage,
    sessionWindowRenewalMinutes,
    // Templates permitidos para API Oficial
    allowedTemplates,
    color: finalColor,
    // Plataforma do dispositivo
    devicePlatform
  });

  // Invalida o cache token->whatsapp do middleware tokenAuth (chave whatsappToken:{token})
  if (oldWhatsappToken) {
    serviceCache.invalidate(`whatsappToken:${oldWhatsappToken}`);
  }
  if (token && token !== oldWhatsappToken) {
    serviceCache.invalidate(`whatsappToken:${token}`);
  }

  if (!requestQR) {
    await AssociateWhatsappQueue(whatsapp, queueIds);
  }

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
