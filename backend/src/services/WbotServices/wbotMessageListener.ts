import path, { join } from "path";
import { promisify } from "util";
import { readFile, writeFile } from "fs";
import fs from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull } from "lodash";
import { REDIS_URI_MSG_CONN } from "../../config/redis";
import axios from "axios";
import { generatePdfThumbnail } from "../../helpers/PdfThumbnailGenerator";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  GroupMetadata,
  jidNormalizedUser,
  delay,
  MediaType,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket,
  downloadContentFromMessage,
  AnyMessageContent,
  generateWAMessageContent,
  generateWAMessageFromContent
} from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Mutex } from "async-mutex";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { resolveMessageContact, resolveGroupContact } from "../ContactResolution/ContactResolverService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { ticketEventBus } from "../TicketServices/TicketEventBus";
import { messageEventBus } from "../MessageServices/MessageEventBus";
import formatBody from "../../helpers/Mustache";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import sendFaceMessage from "../FacebookServices/sendFacebookMessage";
import moment from "moment";
import Queue from "../../models/Queue";

// =============================================================================
// LOCK POR JID - Evita condição de corrida na criação de contatos
// =============================================================================
// Mapa de locks por JID para garantir que apenas uma thread por vez
// possa criar contato para o mesmo JID
const jidLocks = new Map<string, Promise<void>>();

/**
 * Adquire um lock para um JID específico
 * Retorna uma função para liberar o lock
 */
const acquireJidLock = async (jid: string): Promise<() => void> => {
  const normalizedJid = jidNormalizedUser(jid);

  // Aguardar lock existente
  while (jidLocks.has(normalizedJid)) {
    try {
      await jidLocks.get(normalizedJid);
    } catch (e) {
      // Ignora erros de locks anteriores
    }
  }

  // Criar novo lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = () => {
      jidLocks.delete(normalizedJid);
      resolve();
    };
  });

  jidLocks.set(normalizedJid, lockPromise);

  return releaseLock!;
};

/**
 * Executa uma função com lock por JID
 */
const withJidLock = async <T>(jid: string, fn: () => Promise<T>): Promise<T> => {
  const release = await acquireJidLock(jid);
  try {
    return await fn();
  } finally {
    release();
  }
};
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";

// Mutex global compartilhado para evitar race conditions na criação de tickets
// Um mutex por companyId para não bloquear mensagens de empresas diferentes
const ticketMutexes = new Map<number, Mutex>();

function getTicketMutex(companyId: number): Mutex {
  if (!ticketMutexes.has(companyId)) {
    ticketMutexes.set(companyId, new Mutex());
  }
  return ticketMutexes.get(companyId)!;
}
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import QueueAutoFileService from "../QueueServices/QueueAutoFileService";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import { sayChatbot } from "./ChatBotListener";
import MarkDeleteWhatsAppMessage from "./MarkDeleteWhatsAppMessage";
import ListUserQueueServices from "../UserQueueServices/ListUserQueueServices";
import cacheLayer from "../../libs/cache";
import { addLogs } from "../../helpers/addLogs";
import SendWhatsAppMedia, { getMessageOptions } from "./SendWhatsAppMedia";
import QueueRAGService from "../QueueServices/QueueRAGService";

import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { createDialogflowSessionWithModel } from "../QueueIntegrationServices/CreateSessionDialogflow";
import { queryDialogFlow } from "../QueueIntegrationServices/QueryDialogflow";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowFileService from "../FileServices/ShowService";

import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import typebotListener from "../TypebotServices/typebotListener";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import ContactTag from "../../models/ContactTag";
import pino from "pino";
import BullQueues from "../../libs/queue";
import { Transform } from "stream";
import { msgDB } from "../../libs/wbot";
import { CheckSettings1, CheckCompanySetting } from "../../helpers/CheckSettings";
import { title } from "process";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";
import { add, differenceInMilliseconds } from "date-fns";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";

const os = require("os");

ffmpeg.setFfmpegPath(ffmpegPath.path);

const DEBUG_WBOT_LOGS = process.env.WBOT_DEBUG === "true";
const debugLog = (...args: unknown[]): void => {
  if (DEBUG_WBOT_LOGS) {
    logger.debug({ scope: "wbot", payload: args });
  }
};

const request = require("request");

let i = 0;

setInterval(() => {
  i = 0;
}, 5000);

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}
const sessionsOpenAi: SessionOpenAi[] = [];

const writeFileAsync = promisify(writeFile);

interface GroupMetadataCacheEntry {
  subject: string;
  expiresAt: number;
}

const GROUP_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const GROUP_METADATA_RATE_LIMIT_BACKOFF_MS = 30 * 1000;
const groupMetadataCache = new Map<string, GroupMetadataCacheEntry>();
const groupMetadataBackoffUntil = new Map<string, number>();

const getFallbackGroupName = (remoteJid: string): string => {
  if (!remoteJid) return "Grupo";
  return remoteJid.split("@")[0] || remoteJid;
};

const getGroupMetadataFromCache = (remoteJid: string): GroupMetadataCacheEntry | undefined => {
  const entry = groupMetadataCache.get(remoteJid);
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) {
    return entry;
  }
  groupMetadataCache.delete(remoteJid);
  return undefined;
};

const setGroupMetadataCache = (remoteJid: string, subject: string): void => {
  groupMetadataCache.set(remoteJid, {
    subject,
    expiresAt: Date.now() + GROUP_METADATA_CACHE_TTL_MS
  });
};

const shouldBackoffGroupMetadata = (remoteJid: string): boolean => {
  const until = groupMetadataBackoffUntil.get(remoteJid);
  if (!until) return false;
  if (until > Date.now()) {
    return true;
  }
  groupMetadataBackoffUntil.delete(remoteJid);
  return false;
};

const registerGroupMetadataBackoff = (remoteJid: string): void => {
  groupMetadataBackoffUntil.set(remoteJid, Date.now() + GROUP_METADATA_RATE_LIMIT_BACKOFF_MS);
};

const isRateLimitError = (error: any): boolean => {
  if (!error) return false;
  const dataCode = error?.data;
  const outputCode = error?.output?.statusCode;
  const message: string = error?.message || "";
  return dataCode === 429 || outputCode === 429 || message.includes("rate-overlimit") || message.includes("overlimit");
};

function removeFile(directory) {
  fs.unlink(directory, error => {
    if (error) throw error;
  });
}

const getTimestampMessage = (msgTimestamp: any) => {
  return msgTimestamp * 1;
};

const multVecardGet = function (param: any) {
  let output = " ";

  let name = param
    .split("\n")[2]
    .replace(";;;", "\n")
    .replace("N:", "")
    .replace(";", "")
    .replace(";", " ")
    .replace(";;", " ")
    .replace("\n", "");
  let inicio = param.split("\n")[4].indexOf("=");
  let fim = param.split("\n")[4].indexOf(":");
  let contact = param
    .split("\n")[4]
    .substring(inicio + 1, fim)
    .replace(";", "");
  let contactSemWhats = param.split("\n")[4].replace("item1.TEL:", "");
  //console.log(contact);
  if (contact != "item1.TEL") {
    output = output + name + ": 📞" + contact + "" + "\n";
  } else output = output + name + ": 📞" + contactSemWhats + "" + "\n";
  return output;
};

const contactsArrayMessageGet = (msg: any) => {
  let contactsArray = msg.message?.contactsArrayMessage?.contacts;
  let vcardMulti = contactsArray.map(function (item, indice) {
    return item.vcard;
  });

  let bodymessage = ``;
  vcardMulti.forEach(function (vcard, indice) {
    bodymessage += vcard + "\n\n" + "";
  });

  let contacts = bodymessage.split("BEGIN:");

  contacts.shift();
  let finalContacts = "";
  for (let contact of contacts) {
    finalContacts = finalContacts + multVecardGet(contact);
  }

  return finalContacts;
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const msgType = getContentType(msg.message);
  if (msg.message?.extendedTextMessage && msg.message?.extendedTextMessage?.contextInfo && msg.message?.extendedTextMessage?.contextInfo?.externalAdReply) {
    return 'adMetaPreview'; // Adicionado para tratar mensagens de anúncios;
  }
  if (msg.message?.viewOnceMessageV2) {
    return "viewOnceMessageV2";
  }
  return msgType;
};
const getAd = (msg: any): string => {
  if (
    msg.key.fromMe &&
    msg.message?.listResponseMessage?.contextInfo?.externalAdReply
  ) {
    let bodyMessage = `*${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title}*`;

    bodyMessage += `\n\n${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.body}`;

    return bodyMessage;
  }
};

const getBodyButton = (msg: any): string => {
  try {
    if (
      msg?.messageType === "buttonsMessage" ||
      msg?.message?.buttonsMessage?.contentText
    ) {
      let bodyMessage = `[BUTTON]\n\n*${msg?.message?.buttonsMessage?.contentText}*\n\n`;
      // eslint-disable-next-line no-restricted-syntax
      for (const button of msg.message?.buttonsMessage?.buttons) {
        bodyMessage += `*${button.buttonId}* - ${button.buttonText.displayText}\n`;
      }

      return bodyMessage;
    }
    if (msg?.messageType === "viewOnceMessage" || msg?.message?.viewOnceMessage?.message?.interactiveMessage) {
      let bodyMessage = '';
      const buttons =
        msg?.message?.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage?.buttons;

      const bodyTextWithPix = buttons?.[0]?.name === 'review_and_pay';
      const bodyTextWithButtons = msg?.message?.viewOnceMessage?.message?.interactiveMessage?.body?.text;

      if (bodyTextWithPix) {
        bodyMessage += `[PIX]`;
      } else
        if (bodyTextWithButtons) {
          bodyMessage += `[BOTOES]`;
        }

      return bodyMessage;
    }

    if (msg?.messageType === "interactiveMessage" || msg?.message?.interactiveMessage) {
      let bodyMessage = '';


      // Verifica se há botões na mensagem
      const buttons = msg?.message?.interactiveMessage?.nativeFlowMessage?.buttons;


      // Verifica se buttons é um array e se contém o botão 'reviewand_pay'
      const bodyTextWithPix = Array.isArray(buttons) && buttons.some(button => button.name = 'review_and_pay');

      if (bodyTextWithPix) {
        bodyMessage += `[PIX]`;

      } else {

      }

      // Log do bodyMessage final antes do retorno

      // Retornar bodyMessage se não estiver vazio
      return bodyMessage || null; // Verifique se este ponto é alcançado
    }

    if (msg?.messageType === "viewOnceMessage" || msg?.message?.viewOnceMessage?.message?.interactiveMessage) {
      let bodyMessage = '';

      // Verifica se é uma mensagem de PIX (PIX)
      const bodyTextWithPix = msg?.message?.viewOnceMessage?.message?.interactiveMessage?.header?.title;
      // Verifica se é uma mensagem com botões (BOTOES)
      const bodyTextWithButtons = msg?.message?.viewOnceMessage?.message?.interactiveMessage?.body?.text;

      if (bodyTextWithPix) {
        bodyMessage += `[PIX]`;
      } else
        if (bodyTextWithButtons) {
          bodyMessage += `[BOTOES]`;
        }

      return bodyMessage;
    }


    if (msg?.messageType === "listMessage" || msg?.message?.listMessage?.description) {
      let bodyMessage = `[LIST]\n\n`;
      bodyMessage += msg?.message?.listMessage?.title ? `*${msg?.message?.listMessage?.title}**\n` : 'sem titulo\n';
      bodyMessage += msg?.message?.listMessage?.description ? `*${msg?.message?.listMessage?.description}*\n\n` : 'sem descrição\n\n';
      bodyMessage += msg?.message?.listMessage?.footerText ? `${msg?.message?.listMessage?.footerText}\n\n` : '\n\n';
      const sections = msg?.message?.listMessage?.sections;
      if (sections && sections.length > 0) {
        for (const section of sections) {
          bodyMessage += section?.title ? `*${section.title}*\n` : 'Sem titulo';
          const rows = section?.rows;
          if (rows && rows.length > 0) {
            for (const row of rows) {
              const rowTitle = row?.title || '';
              const rowDescription = row?.description || 'Sem descrição';
              const rowId = row?.rowId || '';
              bodyMessage += `${rowTitle} - ${rowDescription} - ${rowId}\n`;
            }
          }
          bodyMessage += `\n`;
        }
      }
      return bodyMessage;
    }

  } catch (error) {
    logger.error(error);
  }
};

const getBodyPIX = (msg: any): string => {
  try {
    // Verifica se é uma mensagem interativa
    if (msg?.messageType === "interactiveMessage" || msg?.message?.interactiveMessage) {
      let bodyMessage = '[PIX]'; // Inicializa bodyMessage com [PIX]


      // Verifica se há botões na mensagem
      const buttons = msg?.message?.interactiveMessage?.nativeFlowMessage?.buttons;


      // Se buttons existe e contém o botão 'review_and_pay'
      const bodyTextWithPix = Array.isArray(buttons) && buttons.some(button => button.name = 'review_and_pay');

      // Se o botão específico foi encontrado
      if (bodyTextWithPix) {

      } else {

        return ''; // Retorna vazio se não encontrar o botão
      }

      // Log do bodyMessage final antes do retorno

      return bodyMessage; // Retorna [PIX]
    }
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
  }

  return ''; // Retorna uma string vazia se a condição inicial não for satisfeita
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);

    if (type === undefined) console.log(JSON.stringify(msg));

    const types = {
      conversation: msg.message?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      ptvMessage: msg.message?.ptvMessage?.caption,
      extendedTextMessage: msg?.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedDisplayText,
      listResponseMessage:
        msg.message?.listResponseMessage?.title ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage:
        msg.message?.contactsArrayMessage?.contacts &&
        contactsArrayMessageGet(msg),
      //locationMessage: `Latitude: ${msg.message.locationMessage?.degreesLatitude} - Longitude: ${msg.message.locationMessage?.degreesLongitude}`,
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.caption,
      audioMessage: "Áudio",
      interactiveMessage: getBodyPIX(msg),
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      viewOnceMessage: getBodyButton(msg) || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction",
      senderKeyDistributionMessage:
        msg?.message?.senderKeyDistributionMessage
          ?.axolotlSenderKeyDistributionMessage,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      viewOnceMessageV2:
        msg.message?.viewOnceMessageV2?.message?.imageMessage?.caption,
      adMetaPreview: msgAdMetaPreview(
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.thumbnail,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.title,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.body,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.sourceUrl,
        msg.message?.extendedTextMessage?.text
      ), // Adicionado para tratar mensagens de anúncios;
      editedMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation ||
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      ephemeralMessage:
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text,
      imageWhitCaptionMessage:
        msg?.message?.ephemeralMessage?.message?.imageMessage,
      highlyStructuredMessage: msg.message?.highlyStructuredMessage,
      protocolMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation,
      advertising:
        getAd(msg) ||
        msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title,
      pollCreationMessageV3: msg?.message?.pollCreationMessageV3 ? `*Enquete*\n${msg.message.pollCreationMessageV3.name}\n\n${msg.message.pollCreationMessageV3.options.map(option => option.optionName).join('\n')}` : null,
      eventMessage: msg?.message?.eventMessage?.name ? `*Nome do Evento: ${msg.message.eventMessage.name}*\n` : 'sem nome do evento\n',
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(
        `#### Nao achou o type 152: ${type} ${JSON.stringify(msg.message)}`
      );
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getTypeMessage")
      );
    }
    return types[type];
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    console.log(error);
  }
};

const msgAdMetaPreview = (image, title, body, sourceUrl, messageUser) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");
    let data = `data:image/png;base64, ${b64} | ${sourceUrl} | ${title} | ${body} | ${messageUser}`;
    return data;
  }
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  if (!body?.contextInfo?.quotedMessage) return;
  const quoted = extractMessageContent(
    body?.contextInfo?.quotedMessage[
    Object.keys(body?.contextInfo?.quotedMessage).values().next().value
    ]
  );

  return quoted;
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];
  let reaction = msg?.message?.reactionMessage
    ? msg?.message?.reactionMessage?.key?.id
    : "";

  return reaction ? reaction : body?.contextInfo?.stanzaId;
};

const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;

  const senderId =
    msg.participant || msg.key.participant || msg.key.remoteJid || undefined;

  return senderId && jidNormalizedUser(senderId);
};

const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session) => {
  const isGroup = msg.key.remoteJid.includes("g.us");
  const remoteJid = msg.key.remoteJid;
  const rawNumber = remoteJid.replace(/\D/g, "");
  const participantJid = msg.participant || msg.key.participant;
  const participantDigits = participantJid ? participantJid.replace(/\D/g, "") : "";
  const isLid = remoteJid?.includes("@lid");

  // =================================================================
  // BAILEYS v7: Usar remoteJidAlt e participantAlt quando disponíveis
  // Esses campos fornecem o JID alternativo (PN se LID, ou LID se PN)
  // =================================================================
  const remoteJidAlt = (msg.key as any).remoteJidAlt;
  const participantAlt = (msg.key as any).participantAlt;

  // Se temos remoteJidAlt com PN válido e o remoteJid é LID, usar o Alt
  if (isLid && remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) {
    const altDigits = remoteJidAlt.replace(/\D/g, "");
    if (altDigits.length >= 10 && altDigits.length <= 13) {
      debugLog("[getContactMessage] Usando remoteJidAlt (PN) ao invés de LID", {
        originalLid: remoteJid,
        remoteJidAlt,
        altDigits
      });

      // Salvar mapeamento LID → PN para uso futuro
      try {
        const LidMapping = require("../../models/LidMapping").default;
        const companyId = (wbot as any).companyId || 1;
        await LidMapping.upsert({
          lid: remoteJid,
          phoneNumber: altDigits,
          companyId,
          whatsappId: wbot.id,
          source: "baileys_remoteJidAlt",
          confidence: 0.95
        });
      } catch (e) {
        // Ignorar erros de persistência
      }

      return {
        id: remoteJidAlt,
        name: msg.pushName || altDigits,
        lidJid: remoteJid // Guardar LID original para referência
      };
    }
  }

  // Se temos participantAlt com PN válido e o participant é LID, usar o Alt
  if (participantJid?.includes("@lid") && participantAlt && participantAlt.includes("@s.whatsapp.net")) {
    const altDigits = participantAlt.replace(/\D/g, "");
    if (altDigits.length >= 10 && altDigits.length <= 13) {
      debugLog("[getContactMessage] Usando participantAlt (PN) ao invés de LID", {
        originalLid: participantJid,
        participantAlt,
        altDigits
      });

      // Salvar mapeamento LID → PN para uso futuro
      try {
        const LidMapping = require("../../models/LidMapping").default;
        const companyId = (wbot as any).companyId || 1;
        await LidMapping.upsert({
          lid: participantJid,
          phoneNumber: altDigits,
          companyId,
          whatsappId: wbot.id
        });
      } catch (e) {
        // Ignorar erros de persistência
      }
    }
  }

  const looksPhoneLike = (digits: string) => digits.length >= 10 && digits.length <= 13;

  // CORREÇÃO CRÍTICA: Para mensagens de GRUPOS, sempre usar participant
  // O remoteJid em grupos é o ID do grupo (xxxxx@g.us), não o número do contato
  let contactJid;

  if (isGroup) {
    // Em grupos, SEMPRE usar participant (quem enviou a mensagem)
    if (!participantJid) {
      debugLog("[getContactMessage] ERRO: Mensagem de grupo sem participant", {
        remoteJid,
        msgKey: msg.key
      });
      return { id: remoteJid, name: "Grupo" };
    }

    // Validar se participant é um número válido
    // VALIDAÇÃO CRÍTICA: Rejeitar IDs Meta (> 13 dígitos) explicitamente
    if (participantDigits.length > 13) {
      debugLog("[getContactMessage] REJEITADO: Participant é um ID Meta (muito longo)", {
        participantJid,
        participantDigits,
        length: participantDigits.length
      });
      // Retornar dados do GRUPO como fallback, não do participant inválido
      return {
        id: remoteJid,
        name: msg.pushName || "Participante de Grupo",
        isGroupParticipant: true,
        participantName: msg.pushName // Guardar nome para uso futuro
      };
    }

    if (!looksPhoneLike(participantDigits)) {
      debugLog("[getContactMessage] AVISO: Participant de grupo com formato inválido", {
        participantJid,
        participantDigits,
        length: participantDigits.length
      });
      // Tentar extrair número do JID mesmo assim
      const jidParts = participantJid.split('@')[0];
      const cleanJid = jidParts.replace(/\D/g, "");
      if (looksPhoneLike(cleanJid)) {
        contactJid = `${cleanJid}@s.whatsapp.net`;
        debugLog("[getContactMessage] Número extraído do JID", { contactJid });
      } else {
        // Número inválido, retornar dados do grupo como fallback
        debugLog("[getContactMessage] AVISO: Impossível extrair número válido, usando grupo como fallback", {
          participantJid,
          cleanJid,
          length: cleanJid.length
        });
        return {
          id: remoteJid,
          name: msg.pushName || "Participante de Grupo",
          isGroupParticipant: true,
          participantName: msg.pushName
        };
      }
    } else {
      contactJid = participantJid;
    }
  } else {
    // Em conversas diretas (não-grupo)
    // Em alguns eventos de sistema (ex.: chamadas), remoteJid pode vir com um identificador interno.
    // Nesses casos, o remetente real costuma estar em participant.
    contactJid =
      !isGroup && participantJid && looksPhoneLike(participantDigits) && !looksPhoneLike(rawNumber)
        ? participantJid
        : remoteJid;
  }

  // CORREÇÃO: Para mensagens fromMe=true com LID, tentar resolver o número real
  // O WhatsApp às vezes usa LID ao invés do número real quando enviamos pelo celular
  if (msg.key.fromMe && isLid && !isGroup) {
    // Log detalhado para debug de mensagens fromMe com LID
    logger.info("[getContactMessage] Mensagem fromMe=true com LID - tentando resolver", {
      remoteJid,
      remoteJidAlt: (msg.key as any).remoteJidAlt,
      participantAlt: (msg.key as any).participantAlt,
      senderPn: (msg as any).senderPn,
      pushName: msg.pushName,
      verifiedBizName: (msg as any).verifiedBizName,
      messageKeys: Object.keys(msg.key || {}),
      messageTopLevelKeys: Object.keys(msg || {}).filter(k => !['message', 'key'].includes(k))
    });

    // Tentar obter o número real do store/cache do Baileys
    try {
      const sock = wbot as any;

      // 0. PRIORIDADE MÁXIMA: Usar signalRepository.lidMapping.getPNForLID() do Baileys
      const lidStore = sock.signalRepository?.lidMapping;
      if (lidStore?.getPNForLID) {
        const lidId = remoteJid.replace("@lid", "");
        try {
          const resolvedPN = await lidStore.getPNForLID(lidId);
          if (resolvedPN) {
            const pnDigits = resolvedPN.replace(/\D/g, "");
            if (looksPhoneLike(pnDigits)) {
              contactJid = resolvedPN.includes("@") ? resolvedPN : `${pnDigits}@s.whatsapp.net`;
              logger.info("[getContactMessage] LID resolvido via signalRepository.lidMapping.getPNForLID", {
                originalLid: remoteJid,
                resolvedPN,
                resolvedJid: contactJid
              });

              // Salvar mapeamento para uso futuro
              try {
                const LidMapping = require("../../models/LidMapping").default;
                const companyId = sock.companyId || 1;
                await LidMapping.upsert({
                  lid: remoteJid,
                  phoneNumber: pnDigits,
                  companyId,
                  whatsappId: wbot.id
                });
              } catch (e) { }
            }
          }
        } catch (e) {
          debugLog("[getContactMessage] Erro ao usar getPNForLID", { err: (e as any)?.message });
        }
      }

      // 0.5. Consultar tabela LidMappings (cache persistente)
      if (contactJid === remoteJid) {
        try {
          const LidMapping = require("../../models/LidMapping").default;
          const companyId = sock.companyId || 1;
          const savedMapping = await LidMapping.findOne({
            where: { lid: remoteJid, companyId }
          });
          if (savedMapping?.phoneNumber) {
            const pnDigits = savedMapping.phoneNumber.replace(/\D/g, "");
            if (looksPhoneLike(pnDigits)) {
              contactJid = `${pnDigits}@s.whatsapp.net`;
              logger.info("[getContactMessage] LID resolvido via tabela LidMappings", {
                originalLid: remoteJid,
                phoneNumber: savedMapping.phoneNumber,
                resolvedJid: contactJid
              });
            }
          }
        } catch (e) {
          debugLog("[getContactMessage] Erro ao consultar LidMappings", { err: (e as any)?.message });
        }
      }

      // 1. PRIORIDADE MÁXIMA: senderPn (campo mais confiável do Baileys)
      const senderPn = (msg as any).senderPn;
      if (senderPn) {
        const senderDigits = senderPn.replace(/\D/g, "");
        if (looksPhoneLike(senderDigits)) {
          contactJid = senderPn.includes("@") ? senderPn : `${senderDigits}@s.whatsapp.net`;
          debugLog("[getContactMessage] LID resolvido via senderPn (MAIS CONFIÁVEL)", {
            originalLid: remoteJid,
            senderPn,
            resolvedJid: contactJid
          });
        }
      }

      // 2. phoneNumber no Contact (presente em alguns contatos)
      if (contactJid === remoteJid && sock.store?.contacts?.[remoteJid]) {
        const storedContact = sock.store.contacts[remoteJid];
        if (storedContact.phoneNumber) {
          const pnDigits = storedContact.phoneNumber.replace(/\D/g, "");
          if (looksPhoneLike(pnDigits)) {
            contactJid = `${pnDigits}@s.whatsapp.net`;
            debugLog("[getContactMessage] LID resolvido via phoneNumber do Contact", {
              originalLid: remoteJid,
              phoneNumber: storedContact.phoneNumber,
              resolvedJid: contactJid
            });
          }
        }
      }

      // 3. Baileys pode ter o mapeamento LID -> número real no store
      if (contactJid === remoteJid && sock.store?.contacts) {
        const lidContact = sock.store.contacts[remoteJid];
        if (lidContact?.id && lidContact.id.includes("@s.whatsapp.net")) {
          contactJid = lidContact.id;
          debugLog("[getContactMessage] LID resolvido via store.contacts", {
            originalLid: remoteJid,
            resolvedJid: contactJid
          });
        }
      }

      // Alternativa: verificar se há um número no pushName da mensagem
      if (contactJid === remoteJid && msg.pushName) {
        const pushNameDigits = msg.pushName.replace(/\D/g, "");
        if (looksPhoneLike(pushNameDigits)) {
          // pushName contém um número válido, usar como JID
          contactJid = `${pushNameDigits}@s.whatsapp.net`;
          debugLog("[getContactMessage] LID resolvido via pushName", {
            originalLid: remoteJid,
            pushName: msg.pushName,
            resolvedJid: contactJid
          });
        }
      }
    } catch (err) {
      debugLog("[getContactMessage] Erro ao tentar resolver LID", { err, remoteJid });
    }
  }

  const contactRawNumber = contactJid.replace(/\D/g, "");
  const isLidContact = contactJid.includes("@lid") || remoteJid?.includes("@lid");

  // Validação final: número deve ter tamanho válido OU ser um @lid (que será tratado por verifyContact)
  if (!looksPhoneLike(contactRawNumber) && !isLidContact) {
    debugLog("[getContactMessage] ERRO FINAL: Número com tamanho inválido", {
      contactJid,
      contactRawNumber,
      length: contactRawNumber.length,
      isGroup,
      participantJid,
      isLidContact
    });
    return null;
  }


  return isGroup
    ? {
      id: contactJid, // CORREÇÃO: usar contactJid (participant) ao invés de getSenderMessage
      name: msg.pushName || contactRawNumber
    }
    : {
      id: contactJid,
      name: msg.key.fromMe ? contactRawNumber : msg.pushName || contactRawNumber
    };
};

// const downloadMedia = async (msg: proto.IWebMessageInfo, companyId: number, whatsappId: number) => {
//   const mineType =
//     msg.message?.imageMessage ||
//     msg.message?.audioMessage ||
//     msg.message?.videoMessage ||
//     msg.message?.stickerMessage ||
//     msg.message?.documentMessage ||
//     msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.documentMessage ||
//     msg.message?.ephemeralMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.stickerMessage ||
//     msg.message?.ephemeralMessage?.message?.imageMessage ||
//     msg.message?.viewOnceMessage?.message?.imageMessage ||
//     msg.message?.viewOnceMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.imageMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.documentMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
//     msg.message?.interactiveMessage?.header?.imageMessage ||
//     msg.message?.interactiveMessage?.header?.documentMessage ||
//     msg.message?.interactiveMessage?.header?.videoMessage;

//   // eslint-disable-next-line no-nested-ternary
//   const messageType = msg.message?.documentMessage
//     ? "document"
//     : mineType.mimetype.split("/")[0].replace("application", "document")
//       ? (mineType.mimetype
//         .split("/")[0]
//         .replace("application", "document") as MediaType)
//       : (mineType.mimetype.split("/")[0] as MediaType);

//   let stream: Transform;
//   let contDownload = 0;

//   while (contDownload < 10 && !stream) {
//     try {
//       const { mediaKey, directPath, url } =
//         msg.message?.imageMessage ||
//         msg.message?.audioMessage ||
//         msg.message?.videoMessage ||
//         msg.message?.stickerMessage ||
//         msg.message?.documentMessage ||
//         msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
//         msg.message?.ephemeralMessage?.message?.audioMessage ||
//         msg.message?.ephemeralMessage?.message?.documentMessage ||
//         msg.message?.ephemeralMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.stickerMessage ||
//         msg.message?.ephemeralMessage?.message?.imageMessage ||
//         msg.message?.viewOnceMessage?.message?.imageMessage ||
//         msg.message?.viewOnceMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.imageMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.audioMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.documentMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
//         msg.message?.interactiveMessage?.header?.imageMessage ||
//         msg.message?.interactiveMessage?.header?.documentMessage ||
//         msg.message?.interactiveMessage?.header?.videoMessage ||
//         { mediakey: undefined, directPath: undefined, url: undefined };
//       // eslint-disable-next-line no-await-in-loop
//       stream = await downloadContentFromMessage(
//         { mediaKey, directPath, url: directPath ? "" : url },
//         messageType
//       );

//     } catch (error) {
//       contDownload += 1;
//       // eslint-disable-next-line no-await-in-loop, no-loop-func
//       await new Promise(resolve => { setTimeout(resolve, 1000 * contDownload * 2) }
//       );

//       logger.warn(
//         `>>>> erro ${contDownload} de baixar o arquivo ${msg?.key.id} companie ${companyId} conexão ${whatsappId}`
//       );

//       if (contDownload === 10) {
//         logger.warn(
//           `>>>> erro ao baixar o arquivo ${JSON.stringify(msg)}`
//         );
//       }
//     }
//   }

//   let buffer = Buffer.from([]);
//   try {
//     // eslint-disable-next-line no-restricted-syntax
//     for await (const chunk of stream) {
//       buffer = Buffer.concat([buffer, chunk]);
//     }
//   } catch (error) {
//     return { data: "error", mimetype: "", filename: "" };
//   }

//   if (!buffer) {
//     Sentry.setExtra("ERR_WAPP_DOWNLOAD_MEDIA", { msg });
//     Sentry.captureException(new Error("ERR_WAPP_DOWNLOAD_MEDIA"));
//     throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
//   }
//   let filename = msg.message?.documentMessage?.fileName || "";

//   if (!filename) {
//     const ext = mineType.mimetype.split("/")[1].split(";")[0];
//     filename = `${new Date().getTime()}.${ext}`;
//   }
//   const media = {
//     data: buffer,
//     mimetype: mineType.mimetype,
//     filename
//   };
//   return media;
// };

const getUnpackedMessage = (msg: proto.IWebMessageInfo) => {
  return (
    msg.message?.documentWithCaptionMessage?.message ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg.message?.ephemeralMessage?.message ||
    msg.message?.viewOnceMessage?.message ||
    msg.message?.viewOnceMessageV2?.message ||
    msg.message?.ephemeralMessage?.message ||
    msg.message?.templateMessage?.hydratedTemplate ||
    msg.message?.templateMessage?.hydratedFourRowTemplate ||
    msg.message?.templateMessage?.fourRowTemplate ||
    msg.message?.interactiveMessage?.header ||
    msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate ||
    msg.message
  )
}
const getMessageMedia = (message: proto.IMessage) => {
  return (
    message?.imageMessage ||
    message?.audioMessage ||
    message?.videoMessage ||
    message?.stickerMessage ||
    message?.documentMessage || null
  );
}
const downloadMedia = async (msg: proto.IWebMessageInfo, isImported: Date = null, wbot: Session, ticket: Ticket) => {
  const unpackedMessage = getUnpackedMessage(msg);
  const message = getMessageMedia(unpackedMessage);
  if (!message) {
    return null;
  }
  const fileLimit = parseInt(await CheckSettings1("downloadLimit", "9999"), 10);
  if (wbot && message?.fileLength && +message.fileLength > fileLimit * 1024 * 1024) {
    throw new Error("ERR_FILESIZE_OVER_LIMIT");
  }

  if (msg.message?.stickerMessage) {
    const urlAnt = "https://web.whatsapp.net";
    const directPath = msg.message?.stickerMessage?.directPath;
    const newUrl = "https://mmg.whatsapp.net";
    const final = newUrl + directPath;
    if (msg.message?.stickerMessage?.url?.includes(urlAnt)) {
      msg.message.stickerMessage.url = msg.message?.stickerMessage.url.replace(
        urlAnt,
        final
      );
    }
  }

  let buffer;
  try {
    buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger,
        reuploadRequest: wbot.updateMediaMessage
      }
    );
  } catch (err) {
    if (isImported) {
      console.log(
        "Falha ao fazer o download de uma mensagem importada, provavelmente a mensagem já não esta mais disponível"
      );
    } else {
      console.error("Erro ao baixar mídia:", err);
    }
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.ephemeralMessage?.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.imageMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
    msg.message?.interactiveMessage?.header?.imageMessage ||
    msg.message?.interactiveMessage?.header?.documentMessage ||
    msg.message?.interactiveMessage?.header?.videoMessage;

  if (!filename) {
    const ext = mineType.mimetype.split("/")[1].split(";")[0];
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

const verifyContact = async (
  msgContact: IMe,
  wbot: Session,
  companyId: number,
  userId: number = null
): Promise<Contact> => {
  // VALIDAÇÃO CRÍTICA: msgContact pode ser null se getContactMessage falhou
  if (!msgContact || !msgContact.id) {
    logger.error("[verifyContact] msgContact inválido ou null", { msgContact });
    return null as any;
  }

  let profilePicUrl = ""; // Busca de avatar é feita por serviço dedicado, não aqui.
  const normalizedJid = jidNormalizedUser(msgContact.id);
  const cleaned = normalizedJid.replace(/\D/g, "");
  const isGroup = normalizedJid.includes("g.us");
  const isLinkedDevice = msgContact.id.includes("@lid") || normalizedJid.includes("@lid");

  // VALIDAÇÃO RIGOROSA: Rejeitar números com tamanho inválido
  // Números BR válidos devem ter entre 10 e 13 dígitos (55 + DDD + 8/9)
  if (!isGroup && !isLinkedDevice) {
    const isPhoneLike = cleaned.length >= 10 && cleaned.length <= 13;
    if (!isPhoneLike) {
      logger.warn("[verifyContact] Ignorando identificador não-phone-like (evita contato duplicado)", {
        originalJid: msgContact.id,
        normalizedJid,
        cleanedLength: cleaned.length,
        pushName: msgContact.name,
        companyId
      });
      return null as any;
    }
  }

  // VALIDAÇÃO EXTRA: Para números normais (não-LID, não-grupo), validar tamanho
  if (!isGroup && !isLinkedDevice) {
    if (cleaned.length > 13) {
      logger.error("[verifyContact] REJEITADO: Número muito longo (provavelmente ID interno)", {
        originalJid: msgContact.id,
        normalizedJid,
        cleaned,
        length: cleaned.length,
        pushName: msgContact.name,
        companyId
      });
      return null as any;
    }
  }

  if (isLinkedDevice) {
    debugLog("[verifyContact] JID @lid detectado", {
      originalJid: msgContact.id,
      normalizedJid,
      pushName: msgContact.name,
      cleaned
    });

    // =================================================================
    // ESTRATÉGIA -1 (PRIORIDADE ABSOLUTA): Tabela LidMappings (cache persistente)
    // =================================================================
    // Quando o evento lid-mapping.update é recebido, salvamos no banco.
    // Isso é mais confiável que consultar o signalRepository em tempo real.
    try {
      const LidMapping = require("../../models/LidMapping").default;
      const savedMapping = await LidMapping.findOne({
        where: {
          lid: normalizedJid,
          companyId,
          // Preferir mapeamentos do evento Baileys (mais confiáveis)
          [Op.or]: [
            { source: "baileys_lid_mapping_event" },
            { source: "recent_ticket_match" },
            { confidence: { [Op.gte]: 0.8 } }
          ]
        },
        order: [
          // Ordenar por confiança (maior primeiro)
          ["confidence", "DESC"],
          // Depois por data (mais recente primeiro)
          ["updatedAt", "DESC"]
        ]
      });

      if (savedMapping?.phoneNumber) {
        const existingByMapping = await Contact.findOne({
          where: {
            [Op.or]: [
              { canonicalNumber: savedMapping.phoneNumber },
              { number: savedMapping.phoneNumber }
            ],
            companyId,
            isGroup: false
          }
        });

        if (existingByMapping) {
          logger.info("[verifyContact] LID resolvido via tabela LidMappings (PRIORIDADE MÁXIMA)", {
            lid: normalizedJid,
            phoneNumber: savedMapping.phoneNumber,
            source: savedMapping.source,
            confidence: savedMapping.confidence,
            contactId: existingByMapping.id,
            contactName: existingByMapping.name
          });
          // Atualizar remoteJid do contato para acelerar futuras buscas
          if (!existingByMapping.remoteJid || existingByMapping.remoteJid !== normalizedJid) {
            await existingByMapping.update({ remoteJid: normalizedJid });
          }
          return existingByMapping;
        }
      }
    } catch (err: any) {
      debugLog("[verifyContact] Erro ao consultar LidMappings", { err: err?.message });
    }

    // =================================================================
    // ESTRATÉGIA 0: Usar signalRepository.lidMapping.getPNForLID() do Baileys v7
    // =================================================================
    // Esta é a função OFICIAL do Baileys para resolver LID → Número de Telefone
    try {
      const lidStore = (wbot as any).signalRepository?.lidMapping;
      if (lidStore?.getPNForLID) {
        const lidId = normalizedJid.replace("@lid", "");
        const resolvedPN = await lidStore.getPNForLID(lidId);

        if (resolvedPN) {
          const phoneNumber = resolvedPN.replace(/\D/g, "");
          logger.info("[verifyContact] LID resolvido via Baileys signalRepository.lidMapping.getPNForLID", {
            lid: normalizedJid,
            resolvedPN,
            phoneNumber
          });

          // Buscar contato existente pelo número resolvido
          const existingByPN = await Contact.findOne({
            where: {
              [Op.or]: [
                { canonicalNumber: phoneNumber },
                { number: phoneNumber }
              ],
              companyId,
              isGroup: false
            }
          });

          if (existingByPN) {
            // Atualizar remoteJid para futuras buscas diretas
            if (!existingByPN.remoteJid || existingByPN.remoteJid !== normalizedJid) {
              await existingByPN.update({ remoteJid: normalizedJid });
            }

            // Persistir mapeamento para uso futuro
            try {
              const LidMapping = require("../../models/LidMapping").default;
              await LidMapping.upsert({
                lid: normalizedJid,
                phoneNumber,
                companyId,
                whatsappId: wbot.id,
                source: "baileys_signal_repository",
                confidence: 0.95,
                verified: true
              });
            } catch (e) { }

            return existingByPN;
          }

          // Mesmo se não encontrar contato, persistir o mapeamento
          try {
            const LidMapping = require("../../models/LidMapping").default;
            await LidMapping.upsert({
              lid: normalizedJid,
              phoneNumber,
              companyId,
              whatsappId: wbot.id,
              source: "baileys_signal_repository",
              confidence: 0.95,
              verified: true
            });
          } catch (e) { }
        }
      }
    } catch (err: any) {
      debugLog("[verifyContact] Erro ao usar signalRepository.lidMapping", { err: err?.message });
    }

    // 1. Para JIDs @lid, buscar por remoteJid (LID) existente
    const existingByLid = await Contact.findOne({
      where: { remoteJid: normalizedJid, companyId }
    });
    if (existingByLid) {
      debugLog("[verifyContact] Contato encontrado pelo LID", { contactId: existingByLid.id });
      return existingByLid;
    }

    // 2. Tentar extrair telefone do pushName (muitas vezes é o próprio número)
    const { canonical: canonicalFromPushName } = safeNormalizePhoneNumber(msgContact.name);
    if (canonicalFromPushName) {
      const existingByNumber = await Contact.findOne({
        where: { canonicalNumber: canonicalFromPushName, companyId, isGroup: false }
      });
      if (existingByNumber) {
        debugLog("[verifyContact] Contato encontrado pelo telefone no pushName", {
          contactId: existingByNumber.id,
          canonicalFromPushName
        });
        return existingByNumber;
      }
    }

    // 3. Tentar extrair telefone do próprio LID (caso seja numero@lid)
    const { canonical: canonicalFromLid } = safeNormalizePhoneNumber(cleaned);
    if (canonicalFromLid) {
      const existingByLidNumber = await Contact.findOne({
        where: { canonicalNumber: canonicalFromLid, companyId, isGroup: false }
      });
      if (existingByLidNumber) {
        debugLog("[verifyContact] Contato encontrado pelo número no LID", {
          contactId: existingByLidNumber.id,
          canonicalFromLid
        });
        return existingByLidNumber;
      }
    }

    // 4. SOLUÇÃO ROBUSTA: Tentar resolver LID via store.contacts do Baileys
    // O Baileys mantém um cache de contatos que pode ter o mapeamento LID → número
    try {
      const sock = wbot as any;
      if (sock.store?.contacts) {
        const storedContact = sock.store.contacts[normalizedJid] || sock.store.contacts[msgContact.id];
        if (storedContact) {
          // Verificar se o contato armazenado tem um número real
          const storedNumber = storedContact.id?.replace(/\D/g, "") || storedContact.notify?.replace(/\D/g, "");
          if (storedNumber && storedNumber.length >= 10 && storedNumber.length <= 13) {
            const existingByStoreNumber = await Contact.findOne({
              where: { canonicalNumber: storedNumber, companyId, isGroup: false }
            });
            if (existingByStoreNumber) {
              logger.info("[verifyContact] LID resolvido via store.contacts do Baileys", {
                lid: normalizedJid,
                resolvedNumber: storedNumber,
                contactId: existingByStoreNumber.id
              });
              return existingByStoreNumber;
            }
          }
        }
      }
    } catch (err) {
      debugLog("[verifyContact] Erro ao consultar store.contacts", { err });
    }

    // 5. REMOVIDO: wbot.onWhatsApp() — chamava API do WhatsApp a cada LID novo,
    //    acumulando chamadas e contribuindo para rate limiting / risco de ban.
    //    A resolução depende dos mapeamentos do Baileys (evento lid-mapping.update).

    // 6. REMOVIDO: Busca parcial por últimos 9 dígitos — alto risco de falso positivo,
    //    poderia associar mensagens ao contato errado se dois contatos compartilham sufixo.

    // 7. ÚLTIMA VERIFICAÇÃO: Buscar contato existente pelo número LID (pode já ter sido criado antes)
    // Se já existe um contato com esse número LID, reutilizá-lo ao invés de criar duplicado
    try {
      const existingByLidNumber = await Contact.findOne({
        where: {
          number: cleaned,
          companyId,
          isGroup: false
        }
      });

      if (existingByLidNumber) {
        // Atualizar remoteJid se não estiver preenchido
        if (!existingByLidNumber.remoteJid) {
          await existingByLidNumber.update({ remoteJid: normalizedJid });
        }
        logger.info("[verifyContact] LID - usando contato existente pelo número", {
          lid: normalizedJid,
          contactId: existingByLidNumber.id,
          contactNumber: existingByLidNumber.number,
          contactName: existingByLidNumber.name
        });
        return existingByLidNumber;
      }
    } catch (err: any) {
      debugLog("[verifyContact] Erro ao buscar contato por número LID", { err: err?.message });
    }

    // 8. ESTRATÉGIA DE TICKET RECENTE - DESATIVADA
    // Esta estratégia foi desativada porque estava causando associações erradas.
    // Quando não conseguia resolver o LID, o sistema pegava QUALQUER ticket recente
    // e associava a mensagem ao contato errado.
    // 
    // Em vez disso, vamos criar um contato temporário com o LID e deixar
    // o evento lid-mapping.update atualizar quando o mapeamento for descoberto.
    debugLog("[verifyContact] Estratégia de ticket recente DESATIVADA - evita associações erradas", {
      lid: normalizedJid,
      pushName: msgContact.name
    });

    // VALIDAÇÃO DE TAMANHO PARA LID - Evita criar contatos com números inválidos
    if (cleaned.length > 13) {
      logger.error("[verifyContact] LID REJEITADO: Número muito longo (acima de 13 dígitos)", {
        originalJid: msgContact.id,
        normalizedJid,
        cleaned,
        length: cleaned.length,
        pushName: msgContact.name,
        companyId
      });
      return null as any;
    }

    // SOLUÇÃO: Criar contato temporário com LID quando não resolver
    // Isso permite processar a mensagem e o contato será atualizado quando o mapeamento for descoberto
    logger.warn("[verifyContact] LID não resolvido - criando contato temporário com LID", {
      normalizedJid,
      pushName: msgContact.name,
      cleaned,
      cleanedLength: cleaned.length,
      companyId,
      metodosTentados: ["LidMappings (cache)", "signalRepository", "remoteJid direto", "pushName", "número no LID", "store.contacts", "número LID existente"]
    });

    // Usar pushName como nome, ou "Contato LID" se não tiver
    const tempName = msgContact.name || `Contato ${cleaned.slice(-6)}`;

    // =================================================================
    // LOCK POR JID - Evita condição de corrida na criação de contatos
    // =================================================================
    return await withJidLock(normalizedJid, async () => {
      // Verificar novamente se contato foi criado enquanto aguardava o lock
      const existingAfterLock = await Contact.findOne({
        where: { remoteJid: normalizedJid, companyId }
      });

      if (existingAfterLock) {
        logger.info("[verifyContact] Contato encontrado após adquirir lock", {
          contactId: existingAfterLock.id,
          lid: normalizedJid
        });
        return existingAfterLock;
      }

      // Criar contato com LID como identificador
      // O número será o próprio LID limpo (será atualizado quando mapeamento for descoberto)
      // Nota: isLinkedDevice é detectado automaticamente pelo CreateOrUpdateContactService via remoteJid.includes("@lid")
      const contactData = {
        name: tempName,
        number: cleaned, // Usar o LID limpo como número temporário
        profilePicUrl: "",
        isGroup: false,
        companyId,
        remoteJid: normalizedJid, // O LID completo - detecta isLinkedDevice automaticamente
        whatsappId: wbot.id,
        wbot
      };

      try {
        const contact = await CreateOrUpdateContactService(contactData);
        logger.info("[verifyContact] Contato temporário criado com LID", {
          contactId: contact.id,
          lid: normalizedJid,
          name: tempName
        });

        // =================================================================
        // HERANÇA DE TAGS PESSOAIS - Copia tags de contato com MESMO NOME
        // Só herda se encontrar contato com pushName idêntico na mesma empresa
        // =================================================================
        try {
          if (tempName && tempName !== `Contato ${cleaned.slice(-6)}`) {
            // Buscar contato real (não-LID) com mesmo nome na mesma empresa
            const matchingContact = await Contact.findOne({
              where: {
                companyId,
                name: tempName,
                isGroup: false,
                id: { [Op.ne]: contact.id },
                remoteJid: { [Op.notLike]: "%@lid" } // Contato real, não outro LID
              },
              include: [{
                model: Tag,
                as: "tags",
                where: {
                  name: {
                    [Op.and]: [
                      { [Op.like]: "#%" },      // Tags pessoais começam com #
                      { [Op.notLike]: "##%" }   // Mas não ## (grupo)
                    ]
                  }
                },
                required: true
              }]
            });

            if (matchingContact?.tags?.length > 0) {
              for (const tag of matchingContact.tags) {
                await ContactTag.findOrCreate({
                  where: { contactId: contact.id, tagId: tag.id },
                  defaults: { contactId: contact.id, tagId: tag.id }
                });
              }

              logger.info("[verifyContact] Tags pessoais herdadas para contato LID (mesmo nome)", {
                lidContactId: contact.id,
                originalContactId: matchingContact.id,
                matchedName: tempName,
                tagsHerdadas: matchingContact.tags.map(t => t.name)
              });
            }
          }
        } catch (tagErr: any) {
          // Erro na herança de tags não deve bloquear o fluxo
          logger.warn("[verifyContact] Erro ao herdar tags pessoais", { err: tagErr?.message });
        }

        return contact;
      } catch (err: any) {
        // Se falhar (ex: duplicado), tentar buscar existente
        logger.warn("[verifyContact] Erro ao criar contato LID, buscando existente", { err: err?.message });
        const existing = await Contact.findOne({ where: { remoteJid: normalizedJid, companyId } });
        if (existing) return existing;

        // Se ainda não encontrar, retornar null como último recurso
        logger.error("[verifyContact] Falha total ao processar LID", { normalizedJid, err: err?.message });
        return null as any;
      }
    });
  }

  // VALIDAÇÃO RIGOROSA: só cria contato se não for grupo e o número tiver entre 10 e 13 dígitos
  const isPhoneLike = !isGroup && cleaned.length >= 10 && cleaned.length <= 13;
  if (!isPhoneLike && !isGroup) {
    // Para não-grupos com número inválido, tentar buscar existente
    const existing = await Contact.findOne({ where: { remoteJid: normalizedJid, companyId } });
    if (existing) {
      logger.warn("[verifyContact] Retornando contato existente com número inválido", {
        contactId: existing.id,
        number: existing.number,
        normalizedJid
      });
      return existing;
    }

    // CRÍTICO: NÃO criar contato com número inválido
    logger.error("[verifyContact] BLOQUEADO: Tentativa de criar contato com número inválido", {
      normalizedJid,
      cleaned,
      length: cleaned.length,
      pushName: msgContact.name,
      companyId
    });
    return null as any;
  }

  // Log detalhado para debug
  debugLog('[verifyContact] processamento de contato', {
    isGroup,
    originalJid: msgContact.id,
    normalizedJid,
    cleaned,
    cleanedLength: cleaned.length,
    name: msgContact.name,
    isLinkedDevice,
    isPhoneLike
  });

  // VALIDAÇÃO FINAL antes de criar/atualizar
  if (!isGroup && cleaned.length > 13) {
    logger.error("[verifyContact] BLOQUEIO FINAL: Número excede 13 dígitos (BR)", {
      cleaned,
      length: cleaned.length,
      normalizedJid,
      companyId
    });
    return null as any;
  }
  // Corrige: nunca sobrescrever nome personalizado
  let nomeContato = msgContact.name;
  if (!isGroup) {
    // Se nome está vazio ou igual ao número, usa número, senão mantém nome
    if (!nomeContato || nomeContato === cleaned) {
      nomeContato = cleaned;
    }
  }
  const contactData = {
    name: nomeContato,
    number: cleaned,
    profilePicUrl,
    isGroup,
    companyId,
    remoteJid: normalizedJid,
    whatsappId: wbot.id,
    wbot
  };

  const contact = await CreateOrUpdateContactService(contactData);
  return contact;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { wid: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session,
  isCampaign: boolean = false  // Se true, não emite para a sala da conversa (background)
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const companyId = ticket.companyId;

  try {
    const media = await downloadMedia(msg, ticket?.imported, wbot, ticket);

    if (!media && ticket.imported) {
      const body =
        "*System:* \nFalha no download da mídia verifique no dispositivo";
      const messageData = {
        //mensagem de texto
        wid: msg.key.id,
        ticketId: ticket.id,
        contactId: msg.key.fromMe ? undefined : ticket.contactId,
        body,
        reactionMessage: msg.message?.reactionMessage,
        fromMe: msg.key.fromMe,
        mediaType: getTypeMessage(msg),
        read: msg.key.fromMe,
        quotedMsgId: quotedMsg?.id || msg.message?.reactionMessage?.key?.id,
        ack: msg.status,
        companyId: companyId,
        remoteJid: msg.key.remoteJid,
        participant: msg.key.participant,
        timestamp: getTimestampMessage(msg.messageTimestamp),
        createdAt: new Date(
          Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
        ).toISOString(),
        dataJson: JSON.stringify(msg),
        ticketImported: ticket.imported,
        isForwarded,
        isPrivate
      };

      await ticket.update({
        lastMessage: body
      });
      logger.error(Error("ERR_WAPP_DOWNLOAD_MEDIA"));
      return CreateMessageService({ messageData, companyId: companyId });
    }

    if (!media) {
      throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
    }

    // if (!media.filename || media.mimetype === "audio/mp4") {
    //   const ext = media.mimetype === "audio/mp4" ? "m4a" : media.mimetype.split("/")[1].split(";")[0];
    //   media.filename = `${new Date().getTime()}.${ext}`;
    // } else {
    //   // ext = tudo depois do ultimo .
    //   const ext = media.filename.split(".").pop();
    //   // name = tudo antes do ultimo .
    //   const name = media.filename.split(".").slice(0, -1).join(".").replace(/\s/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    //   media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
    // }
    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${new Date().getTime()}.${ext}`;
    } else {
      // ext = tudo depois do ultimo .
      const ext = media.filename.split(".").pop();
      // name = tudo antes do ultimo .
      const name = media.filename
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/\s/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
    }

    // Validação de segurança: se contact.id for undefined, usa fallback
    const contactFolder = contact?.id ? `contact${contact.id}` : `contact_imported_${Date.now()}`;

    try {
      // Criar pasta por contato para melhor organização

      const folder = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        `company${companyId}`,
        contactFolder
      );

      // Criar pasta recursivamente se não existir
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }

      await writeFileAsync(
        join(folder, media.filename),
        media.data.toString("base64"),
        "base64"
      ) // Correção adicionada por Altemir 16-08-2023
        .then(() => {
          // console.log("Arquivo salvo com sucesso!");
          if (media.mimetype.includes("audio")) {
            const inputFile = path.join(folder, media.filename);
            let outputFile: string | null = null;

            // Convertemos formatos comuns não suportados em iOS para MP3
            if (/(\.mpeg)$/i.test(inputFile)) {
              outputFile = inputFile.replace(/\.mpeg$/i, ".mp3");
            } else if (/(\.ogg)$/i.test(inputFile)) {
              outputFile = inputFile.replace(/\.ogg$/i, ".mp3");
            } else if (/(\.oga)$/i.test(inputFile)) {
              outputFile = inputFile.replace(/\.oga$/i, ".mp3");
            } else if (/(\.webm)$/i.test(inputFile)) {
              outputFile = inputFile.replace(/\.webm$/i, ".mp3");
            }

            if (!outputFile) return; // formatos já compatíveis (ex.: mp3, m4a)

            return new Promise<void>((resolve, reject) => {
              ffmpeg(inputFile)
                .toFormat("mp3")
                .save(outputFile)
                .on("end", () => {
                  try {
                    // Atualiza media.filename para apontar ao convertido
                    const newName = path.basename(outputFile);
                    media.filename = newName;
                  } catch { }
                  resolve();
                })
                .on("error", (err: any) => {
                  reject(err);
                });
            });
          }
        })
        .then(async () => {
          // Gerar miniatura para PDFs usando helper puro JavaScript (sem GraphicsMagick)
          if (media.mimetype === "application/pdf") {
            try {
              const pdfPath = join(folder, media.filename);
              await generatePdfThumbnail(pdfPath);
            } catch (thumbErr) {
              logger.warn(`Failed to generate PDF thumbnail: ${thumbErr}`);
            }
          }
        });
    } catch (err) {
      Sentry.setExtra("Erro media", {
        companyId: companyId,
        ticket,
        contact,
        media,
        quotedMsg
      });
      Sentry.captureException(err);
      logger.error(err);
    }

    const body = getBodyMessage(msg);

    // Determinar mediaType corretamente (sticker, gif, etc)
    const msgType = getTypeMessage(msg);
    let finalMediaType = media.mimetype.split("/")[0];

    // Stickers são webp - marcar como "sticker" para renderização especial
    if (msgType === "stickerMessage" || media.mimetype === "image/webp") {
      finalMediaType = "sticker";
    }
    // GIFs animados
    if (media.mimetype === "image/gif") {
      finalMediaType = "gif";
    }

    // BUSCAR NOME DO REMETENTE: prioridade 1) pushName da mensagem, 2) store do Baileys
    const participantJid = msg.key.participant || msg.participant;
    let senderName = msg.pushName;
    if (!senderName && participantJid && wbot) {
      try {
        const store = (wbot as any).store;
        if (store?.contacts?.[participantJid]) {
          const contactData = store.contacts[participantJid];
          senderName = contactData?.notify || contactData?.name || contactData?.verifiedName;
          if (senderName) {
            logger.debug(`[verifyMediaMessage] Nome do participante ${participantJid} obtido do store: "${senderName}"`);
          }
        }
      } catch (err) {
        // Silencioso: não falhar por erro ao buscar no store
      }
    }

    const messageData = {
      wid: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: body || media.filename,
      fromMe: msg.key.fromMe,
      read: msg.key.fromMe,
      mediaUrl: `${contactFolder}/${media.filename}`, // Incluir contactId no caminho
      mediaType: finalMediaType,
      quotedMsgId: quotedMsg?.id,
      ack:
        Number(
          String(msg.status).replace("PENDING", "2").replace("NaN", "1")
        ) || 2,
      remoteJid: msg.key.remoteJid,
      participant: participantJid,
      senderName: senderName || undefined,
      dataJson: JSON.stringify(msg),
      ticketTrakingId: ticketTraking?.id,
      createdAt: new Date(
        Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
      ).toISOString(),
      ticketImported: ticket.imported,
      isForwarded,
      isPrivate,
      isCampaign  // Passa para CreateMessageService para evitar emit na conversa
    };

    await ticket.update({
      lastMessage: body || media.filename
    });

    const newMessage = await CreateMessageService({
      messageData,
      companyId: companyId
    });

    if (!msg.key.fromMe && ticket.status === "closed") {
      await ticket.update({ status: "pending" });
      await ticket.reload({
        attributes: [
          "id",
          "uuid",
          "queueId",
          "isGroup",
          "channel",
          "status",
          "contactId",
          "useIntegration",
          "lastMessage",
          "updatedAt",
          "unreadMessages",
          "companyId",
          "whatsappId",
          "imported",
          "lgpdAcceptedAt",
          "amountUsedBotQueues",
          "useIntegration",
          "integrationId",
          "userId",
          "amountUsedBotQueuesNPS",
          "lgpdSendMessageAt",
          "isBot"
        ],
        include: [
          { model: Queue, as: "queue" },
          { model: User, as: "user" },
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ]
      });

      // CQRS: Emitir eventos via TicketEventBus (oldStatus=closed pois ticket reabriu)
      ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, "closed");
      ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
    }

    return newMessage;
  } catch (error) {
    console.log(error);
    logger.warn("Erro ao baixar media: ", JSON.stringify(msg));
  }
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking?: TicketTraking,
  isPrivate?: boolean,
  isForwarded: boolean = false,
  isCampaign: boolean = false,  // Se true, não emite para a sala da conversa (background)
  wbot?: Session  // Opcional para buscar nome do participante no store
) => {
  // console.log("Mensagem recebida:", JSON.stringify(msg, null, 2));
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);
  const companyId = ticket.companyId;

  const participantJid = msg.key.participant || msg.participant;

  // BUSCAR NOME DO REMETENTE: prioridade 1) pushName da mensagem, 2) store do Baileys
  let senderName = msg.pushName;
  if (!senderName && participantJid && wbot) {
    try {
      const store = (wbot as any).store;
      if (store?.contacts?.[participantJid]) {
        const contactData = store.contacts[participantJid];
        senderName = contactData?.notify || contactData?.name || contactData?.verifiedName;
        if (senderName) {
          logger.debug(`[verifyMessage] Nome do participante ${participantJid} obtido do store: "${senderName}"`);
        }
      }
    } catch (err) {
      // Silencioso: não falhar por erro ao buscar no store
    }
  }

  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack:
      Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) ||
      2,
    remoteJid: msg.key.remoteJid,
    participant: participantJid,
    senderName: senderName || undefined,
    dataJson: JSON.stringify(msg),
    ticketTrakingId: ticketTraking?.id,
    isPrivate,
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
    isForwarded,
    isCampaign  // Passa para CreateMessageService para evitar emit na conversa
  };

  await ticket.update({
    lastMessage: body
  });

  await CreateMessageService({ messageData, companyId: companyId });

  if (!msg.key.fromMe && ticket.status === "closed") {

    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket.imported) {
      // CQRS: Emitir via TicketEventBus para broadcast (oldStatus=closed pois ticket reabriu)
      ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, "closed");
      ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
    }
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  try {
    const msgType = getTypeMessage(msg);
    if (!msgType) {
      return;
    }

    const ifType =
      msgType === "conversation" ||
      msgType === "extendedTextMessage" ||
      msgType === "audioMessage" ||
      msgType === "videoMessage" ||
      msgType === "ptvMessage" ||
      msgType === "imageMessage" ||
      msgType === "documentMessage" ||
      msgType === "stickerMessage" ||
      msgType === "buttonsResponseMessage" ||
      msgType === "buttonsMessage" ||
      msgType === "messageContextInfo" ||
      msgType === "locationMessage" ||
      msgType === "liveLocationMessage" ||
      msgType === "contactMessage" ||
      msgType === "voiceMessage" ||
      msgType === "mediaMessage" ||
      msgType === "contactsArrayMessage" ||
      msgType === "reactionMessage" ||
      msgType === "ephemeralMessage" ||
      msgType === "protocolMessage" ||
      msgType === "listResponseMessage" ||
      msgType === "listMessage" ||
      msgType === "interactiveMessage" ||
      msgType === "pollCreationMessageV3" ||
      msgType === "viewOnceMessage" ||
      msgType === "documentWithCaptionMessage" ||
      msgType === "viewOnceMessageV2" ||
      msgType === "editedMessage" ||
      msgType === "advertisingMessage" ||
      msgType === "highlyStructuredMessage" ||
      msgType === "eventMessage" ||
      msgType === "adMetaPreview"; // Adicionado para tratar mensagens de anúncios

    if (!ifType) {
      logger.warn(`#### Nao achou o type em isValidMsg: ${msgType}
${JSON.stringify(msg?.message)}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, msgType });
      Sentry.captureException(new Error("Novo Tipo de Mensagem em isValidMsg"));
    }

    return !!ifType;
  } catch (error) {
    Sentry.setExtra("Error isValidMsg", { msg });
    Sentry.captureException(error);
  }
};

const sendDialogflowAwswer = async (
  wbot: Session,
  ticket: Ticket,
  msg: WAMessage,
  contact: Contact,
  inputAudio: string | undefined,
  companyId: number,
  queueIntegration: QueueIntegrations
) => {
  const session = await createDialogflowSessionWithModel(queueIntegration);

  if (session === undefined) {
    return;
  }

  wbot.presenceSubscribe(contact.remoteJid);
  await delay(500);

  let dialogFlowReply = await queryDialogFlow(
    session,
    queueIntegration.projectName,
    contact.remoteJid,
    getBodyMessage(msg),
    queueIntegration.language,
    inputAudio
  );

  if (!dialogFlowReply) {
    wbot.sendPresenceUpdate("composing", contact.remoteJid);

    const bodyDuvida = formatBody(
      `\u200e *${queueIntegration?.name}:* Não consegui entender sua dúvida.`
    );

    await delay(1000);

    await wbot.sendPresenceUpdate("paused", contact.remoteJid);

    const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, {
      text: bodyDuvida
    });

    await verifyMessage(sentMessage, ticket, contact, undefined, undefined, false, false, wbot);
    return;
  }

  if (dialogFlowReply.endConversation) {
    await ticket.update({
      contactId: ticket.contact.id,
      useIntegration: false
    });
  }

  const image = dialogFlowReply.parameters.image?.stringValue ?? undefined;

  const react = dialogFlowReply.parameters.react?.stringValue ?? undefined;

  const audio = dialogFlowReply.encodedAudio.toString("base64") ?? undefined;

  wbot.sendPresenceUpdate("composing", contact.remoteJid);
  await delay(500);

  let lastMessage;

  for (let message of dialogFlowReply.responses) {
    lastMessage = message.text.text[0] ? message.text.text[0] : lastMessage;
  }
  for (let message of dialogFlowReply.responses) {
    if (message.text) {
      await sendDelayedMessages(
        wbot,
        ticket,
        contact,
        message.text.text[0],
        lastMessage,
        audio,
        queueIntegration
      );
    }
  }
};

async function sendDelayedMessages(
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  message: string,
  lastMessage: string,
  audio: string | undefined,
  queueIntegration: QueueIntegrations
) {
  const companyId = ticket.companyId;
  // console.log("GETTING WHATSAPP SEND DELAYED MESSAGES", ticket.whatsappId, wbot.id)
  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
  const farewellMessage = whatsapp.farewellMessage.replace(/[_*]/g, "");

  // if (react) {
  //   const test =
  //     /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g.test(
  //       react
  //     );
  //   if (test) {
  //     msg.react(react);
  //     await delay(1000);
  //   }
  // }
  const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, {
    text: `\u200e *${queueIntegration?.name}:* ` + message
  });

  await verifyMessage(sentMessage, ticket, contact, undefined, undefined, false, false, wbot);
  if (message != lastMessage) {
    await delay(500);
    wbot.sendPresenceUpdate("composing", contact.remoteJid);
  } else if (audio) {
    wbot.sendPresenceUpdate("recording", contact.remoteJid);
    await delay(500);

    // if (audio && message === lastMessage) {
    //   const newMedia = new MessageMedia("audio/ogg", audio);

    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact, undefined, undefined, false, false, wbot);
    // }

    // if (sendImage && message === lastMessage) {
    //   const newMedia = await MessageMedia.fromUrl(sendImage, {
    //     unsafeMime: true
    //   });
    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact, undefined, undefined, false, false, wbot);
    //   await ticket.update({ lastMessage: "📷 Foto" });
    // }

    if (farewellMessage && message.includes(farewellMessage)) {
      await delay(1000);
      setTimeout(async () => {
        await ticket.update({
          contactId: ticket.contact.id,
          useIntegration: true
        });
        await UpdateTicketService({
          ticketId: ticket.id,
          ticketData: { status: "closed" },
          companyId: companyId
        });
      }, 3000);
    }
  }
}

const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  settings?: any,
  ticketTraking?: TicketTraking
) => {
  const companyId = ticket.companyId;


  // console.log("GETTING WHATSAPP VERIFY QUEUE", ticket.whatsappId, wbot.id)
  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    await ShowWhatsAppService(wbot.id!, companyId);

  let chatbot = false;

  if (queues.length === 1) {
    chatbot = queues[0]?.chatbots.length > 1;
  }

  const enableQueuePosition = settings.sendQueuePosition === "enabled";

  if (queues.length === 1 && !chatbot) {
    const sendGreetingMessageOneQueues =
      settings.sendGreetingMessageOneQueues === "enabled" || false;


    //inicia integração dialogflow/n8n
    if (!msg.key.fromMe && !ticket.isGroup && queues[0].integrationId) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );


      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        null,
        null,
        null,
        null
      );

      if (msg.key.fromMe) {

        await ticket.update({
          typebotSessionTime: moment().toDate(),
          useIntegration: true,
          integrationId: integrations.id
        });
      } else {
        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
      }

      // return;
    }

    if (greetingMessage.length > 1 && sendGreetingMessageOneQueues) {
      const body = formatBody(`${greetingMessage}`, ticket);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {
        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);

        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );
          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                { ...optionsMsg }
              );

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: body
            }
          );
        }
      } else {
        await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
      }
    }

    // Nova lógica inteligente de arquivos
    if (!isNil(queues[0].fileListId)) {
      try {
        // Avaliar se deve enviar arquivos automaticamente
        const decision = await QueueAutoFileService.evaluateAutoSend({
          ticket,
          contact,
          queue: queues[0],
          trigger: "on_enter"
        });

        if (decision.shouldSend) {
          await QueueAutoFileService.sendFiles({
            ticket,
            contact,
            queue: queues[0],
            files: decision.files,
            skipConfirmation: !decision.confirmationNeeded
          });
        } else {
          logger.info({
            ticketId: ticket.id,
            queueId: queues[0].id,
            reason: decision.reason
          }, "Files not sent automatically");
        }
      } catch (error) {
        logger.error({
          error,
          ticketId: ticket.id,
          queueId: queues[0].id
        }, "Error in smart file handling");
      }
    }

    if (queues[0].closeTicket) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          queueId: queues[0].id
          // sendFarewellMessage: false
        },
        ticketId: ticket.id,
        companyId
      });

      return;
    } else {
      await UpdateTicketService({
        ticketData: {
          queueId: queues[0].id,
          status: ticket.status === "lgpd" ? "pending" : ticket.status
        },
        ticketId: ticket.id,
        companyId
      });
    }

    const count = await Ticket.findAndCountAll({
      where: {
        userId: null,
        status: "pending",
        companyId,
        queueId: queues[0].id,
        isGroup: false
      }
    });

    if (enableQueuePosition) {
      // Lógica para enviar posição da fila de atendimento
      const qtd = count.count === 0 ? 1 : count.count;
      const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
      // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
      const bodyFila = formatBody(`${msgFila}`, ticket);
      const debouncedSentMessagePosicao = debounce(
        async () => {
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: bodyFila
            }
          );
        },
        3000,
        ticket.id
      );
      debouncedSentMessagePosicao();
    }

    return;
  }

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  let selectedOption = "";

  if (ticket.status !== "lgpd") {
    selectedOption =
      msg?.message?.buttonsResponseMessage?.selectedButtonId ||
      msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
      getBodyMessage(msg);
  } else {
    if (!isNil(ticket.lgpdAcceptedAt))
      await ticket.update({
        status: "pending"
      });

    await ticket.reload();
  }

  if (String(selectedOption).toLocaleLowerCase() == "sair") {
    // Encerra atendimento


    const ticketData = {
      isBot: false,
      status: "closed",
      sendFarewellMessage: true,
      maxUseBotQueues: 0
    };

    await UpdateTicketService({ ticketData, ticketId: ticket.id, companyId });
    // await ticket.update({ queueOptionId: null, chatbot: false, queueId: null, userId: null, status: "closed"});
    //await verifyQueue(wbot, msg, ticket, ticket.contact);

    // const complationMessage = ticket.whatsapp?.complationMessage;

    // console.log(complationMessage)
    // const textMessage = {
    //   text: formatBody(`\u200e${complationMessage}`, ticket),
    // };

    // if (!isNil(complationMessage)) {
    //   const sendMsg = await wbot.sendMessage(
    //     `${ticket?.contact?.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    //     textMessage
    //   );

    //   await verifyMessage(sendMsg, ticket, ticket.contact);
    // }

    return;
  }

  let choosenQueue =
    chatbot && queues.length === 1
      ? queues[+selectedOption]
      : queues[+selectedOption - 1];


  const typeBot = settings?.chatBotType || "text";

  // Serviço p/ escolher consultor aleatório para o ticket, ao selecionar fila.
  let randomUserId;

  if (choosenQueue) {
    try {
      const userQueue = await ListUserQueueServices(choosenQueue.id);

      if (userQueue.userId > -1) {
        randomUserId = userQueue.userId;
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Ativar ou desativar opção de escolher consultor aleatório.
  /*   let settings = await CompaniesSettings.findOne({
      where: {
        companyId: companyId
      }
    }); */

  const botText = async () => {

    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0];
      const queue = await Queue.findByPk(choosenQueue.id);


      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" &&
        ticket.status !== "open" &&
        !isNil(currentSchedule) &&
        (ticket.amountUsedBotQueues < maxUseBotQueues ||
          maxUseBotQueues === 0) &&
        (!currentSchedule || currentSchedule.inActivity === false) &&
        (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();

          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
            );

            if (
              ticketTraking.chatbotAt !== null &&
              Agora < dataLimite &&
              timeUseBotQueues !== "0" &&
              ticket.amountUsedBotQueues !== 0
            ) {
              return;
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          });
        }

        const outOfHoursMessage = queue.outOfHoursMessage;

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);


          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          // await ticket.update({
          //   queueId: queue.id,
          //   isOutOfHour: true,
          //   amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          // });

          // return;
        }
        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          // amountUsedBotQueues: 0,
          queueId: choosenQueue.id
        },
        // ticketData: { queueId: queues.length ===1 ? null : choosenQueue.id },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        let options = "";
        choosenQueue.chatbots.forEach((chatbot, index) => {
          options += `*[ ${index + 1} ]* - ${chatbot.name}\n`;
        });

        const body = formatBody(
          `\u200e ${choosenQueue.greetingMessage}\n\n${options}\n*[ # ]* Voltar para o menu principal\n*[ Sair ]* Encerrar atendimento`,
          ticket
        );

        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,

          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);

        if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (
        !choosenQueue.chatbots.length &&
        choosenQueue.greetingMessage.length !== 0
      ) {
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
      }

      if (!isNil(choosenQueue.fileListId)) {
        try {
          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.fileListId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: file.path,
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: `\u200e ${file.name}`,
              isPrivate: false,
              isForwarded: false
            });

            await verifyMediaMessage(
              sentMessage,
              ticket,
              ticket.contact,
              ticketTraking,
              false,
              false,
              wbot
            );
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          }
        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000);

      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {
          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });


      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count;
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }
    } else {
      if (ticket.isGroup) return;

      if (
        maxUseBotQueues &&
        maxUseBotQueues !== 0 &&
        ticket.amountUsedBotQueues >= maxUseBotQueues
      ) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
          );


          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
            timeUseBotQueues !== "0" &&
            ticket.amountUsedBotQueues !== 0
          ) {
            return;
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        });
      }

      // if (wbot.waitForSocketOpen()) {
      //   console.log("AGUARDANDO")
      //   console.log(wbot.waitForSocketOpen())
      // }

      wbot.presenceSubscribe(contact.remoteJid);

      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);


      queues.forEach((queue, index) => {
        options += `*[ ${index + 1} ]* - ${queue.name}\n`;
      });
      options += `\n*[ Sair ]* - Encerrar atendimento`;

      const body = formatBody(`\u200e${greetingMessage}\n\n${options}`, ticket);

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);

      await wbot.sendPresenceUpdate("paused", contact.remoteJid);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {

        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );


          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              let sentMessage = await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                { ...optionsMsg }
              );

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentMessage = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );

              await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
        }


        await UpdateTicketService({
          ticketData: {
            // amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          },
          ticketId: ticket.id,
          companyId
        });

        return;
      } else {

        const debouncedSentMessage = debounce(
          async () => {
            const sentMessage = await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: body
              }
            );

            await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
          },
          1000,
          ticket.id
        );

        await UpdateTicketService({
          ticketData: {},
          ticketId: ticket.id,
          companyId
        });

        debouncedSentMessage();
      }
    }
  };

  const botList = async () => {


    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0]
      const queue = await Queue.findByPk(choosenQueue.id);


      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" &&
        ticket.status !== "open" &&
        !isNil(currentSchedule) &&
        (ticket.amountUsedBotQueues < maxUseBotQueues ||
          maxUseBotQueues === 0) &&
        (!currentSchedule || currentSchedule.inActivity === false) &&
        (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();


          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
            );

            if (
              ticketTraking.chatbotAt !== null &&
              Agora < dataLimite &&
              timeUseBotQueues !== "0" &&
              ticket.amountUsedBotQueues !== 0
            ) {
              return;
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          });
        }

        const outOfHoursMessage = queue.outOfHoursMessage;

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);


          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          // await ticket.update({
          //   queueId: queue.id,
          //   isOutOfHour: true,
          //   amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          // });

          // return;

        }
        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          // amountUsedBotQueues: 0,
          queueId: choosenQueue.id
        },
        // ticketData: { queueId: queues.length ===1 ? null : choosenQueue.id },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        const sectionsRows = [];

        choosenQueue.chatbots.forEach((chatbot, index) => {
          sectionsRows.push({
            title: chatbot.name,
            rowId: `${index + 1}`
          });
        });
        sectionsRows.push({
          title: "Voltar Menu Inicial",
          rowId: "#"
        });
        const sections = [
          {
            title: 'Lista de Botões',
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${queue.greetingMessage}\n`),
          title: "Lista\n",
          buttonText: "Clique aqui",
          //footer: ".",
          //listType: 2,
          sections
        };
        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          listMessage
        );

        await verifyMessage(sendMsg, ticket, contact, ticketTraking, undefined, false, false, wbot);

        if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (!choosenQueue.chatbots.length && choosenQueue.greetingMessage.length !== 0) {
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
      }

      if (!isNil(choosenQueue.fileListId)) {
        try {

          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.fileListId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: file.path,
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: `\u200e ${file.name}`,
              isPrivate: false,
              isForwarded: false
            });

            await verifyMediaMessage(
              sentMessage,
              ticket,
              ticket.contact,
              ticketTraking,
              false,
              false,
              wbot
            );
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          }
        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000);

      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {
          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      console.log("======== choose queue ========")
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count;
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }
    } else {
      if (ticket.isGroup) return;

      if (
        maxUseBotQueues &&
        maxUseBotQueues !== 0 &&
        ticket.amountUsedBotQueues >= maxUseBotQueues
      ) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
          );

          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
            timeUseBotQueues !== "0" &&
            ticket.amountUsedBotQueues !== 0
          ) {
            return;
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        });
      }

      // if (wbot.waitForSocketOpen()) {
      //   console.log("AGUARDANDO")
      //   console.log(wbot.waitForSocketOpen())
      // }

      wbot.presenceSubscribe(contact.remoteJid);

      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      console.log("============= queue menu =============")
      const sectionsRows = [];

      queues.forEach((queue, index) => {
        sectionsRows.push({
          title: `${queue.name}`,//queue.name,
          description: `_`,
          rowId: `${index + 1}`
        });
      });

      sectionsRows.push({
        title: "Voltar Menu Inicial",
        rowId: "#"
      });

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);
      const body = formatBody(
        `\u200e${greetingMessage}\n\n${options}`,
        ticket
      );

      await wbot.sendPresenceUpdate('paused', contact.remoteJid)

      if (ticket.whatsapp.greetingMediaAttachment !== null) {

        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );

          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {

              let sentMessage = await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, { ...optionsMsg });

              await verifyMediaMessage(sentMessage, ticket, contact, ticketTraking, false, false, wbot);

            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentMessage = debounce(
            async () => {
              const sections = [
                {
                  title: 'Lista de Botões',
                  rows: sectionsRows
                }
              ];

              const listMessage = {
                title: "Lista\n",
                text: formatBody(`\u200e${greetingMessage}\n`),
                buttonText: "Clique aqui",
                //footer: "_",
                sections
              };

              const sendMsg = await wbot.sendMessage(
                `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                listMessage
              );

              await verifyMessage(sendMsg, ticket, contact, ticketTraking, undefined, false, false, wbot);
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
        }

        await UpdateTicketService({
          ticketData: {
            // amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          },
          ticketId: ticket.id,
          companyId
        });

        return;
      } else {

        const debouncedSentMessage = debounce(
          async () => {
            const sections = [
              {
                title: 'Lista de Botões',
                rows: sectionsRows
              }
            ];

            const listMessage = {
              title: "Lista\n",
              text: formatBody(`\u200e${greetingMessage}\n`),
              buttonText: "Clique aqui",
              //footer: "_",
              sections
            };

            const sendMsg = await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              listMessage
            );

            await verifyMessage(sendMsg, ticket, contact, ticketTraking, undefined, false, false, wbot);
          },
          1000,
          ticket.id
        );

        await UpdateTicketService({
          ticketData: {

          },
          ticketId: ticket.id,
          companyId
        });

        debouncedSentMessage();
      }
    }
  };

  const botButton = async () => {

    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0]
      const queue = await Queue.findByPk(choosenQueue.id);

      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" &&
        ticket.status !== "open" &&
        !isNil(currentSchedule) &&
        (ticket.amountUsedBotQueues < maxUseBotQueues ||
          maxUseBotQueues === 0) &&
        (!currentSchedule || currentSchedule.inActivity === false) &&
        (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();

          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
            );

            if (
              ticketTraking.chatbotAt !== null &&
              Agora < dataLimite &&
              timeUseBotQueues !== "0" &&
              ticket.amountUsedBotQueues !== 0
            ) {
              return;
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          });
        }

        const outOfHoursMessage = queue.outOfHoursMessage;

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);

          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

        }

        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          queueId: choosenQueue.id
        },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        const debouncedSentMessage = debounce(
          async () => {
            try {
              // Busca o número do WhatsApp associado ao ticket
              const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
              if (!whatsapp || !whatsapp.number) {
                console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                throw new Error('Número de WhatsApp não encontrado');
              }
              const botNumber = whatsapp.number;

              const buttons = [];

              // Adiciona os chatbots como botões
              choosenQueue.chatbots.forEach((chatbot, index) => {
                buttons.push({
                  name: 'quick_reply',  // Substitua por 'quick_reply' se necessário, dependendo do contexto
                  buttonParamsJson: JSON.stringify({
                    display_text: chatbot.name,
                    id: `${index + 1}`
                  })
                });
              });

              buttons.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: "Voltar Menu Inicial",
                  id: "#"
                })
              });
              const interactiveMsg = {
                viewOnceMessage: {
                  message: {
                    interactiveMessage: {
                      body: {
                        text: `\u200e${choosenQueue.greetingMessage}`,
                      },
                      nativeFlowMessage: {
                        buttons: buttons,
                        messageParamsJson: JSON.stringify({
                          from: 'apiv2',
                          templateId: '4194019344155670',
                        }),
                      },
                    },
                  },
                },
              };
              const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
              const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber, });
              await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id }
              );
              if (newMsg) {
                await wbot.upsertMessage(newMsg, 'notify');
              }
            } catch (error) {
              console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
            }
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();

        if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (!choosenQueue.chatbots.length && choosenQueue.greetingMessage.length !== 0) {
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
      }

      if (!isNil(choosenQueue.fileListId)) {
        try {

          const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

          const files = await ShowFileService(choosenQueue.fileListId, ticket.companyId)

          const folder = path.resolve(publicFolder, `company${ticket.companyId}`, "fileList", String(files.id))

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: 'medias',
              originalname: file.path,
              encoding: '7bit',
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path),
            } as Express.Multer.File

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({ media: mediaSrc, ticket, body: `\u200e ${file.name}`, isPrivate: false, isForwarded: false });

            await verifyMediaMessage(sentMessage, ticket, ticket.contact, ticketTraking, false, false, wbot);
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          };


        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000)


      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {

          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id,
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId,
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      console.log("======== choose queue ========")
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }


    } else {

      if (ticket.isGroup) return;

      if (maxUseBotQueues && maxUseBotQueues !== 0 && ticket.amountUsedBotQueues >= maxUseBotQueues) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));


          if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
            return
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        })
      }

      wbot.presenceSubscribe(contact.remoteJid);


      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      console.log("============= queue menu =============")

      const body = formatBody(
        `\u200e${greetingMessage}\n\n${options}`,
        ticket
      );

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);

      await wbot.sendPresenceUpdate('paused', contact.remoteJid)

      if (ticket.whatsapp.greetingMediaAttachment !== null) {


        const filePath = path.resolve("public", `company${companyId}`, ticket.whatsapp.greetingMediaAttachment);

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              try {
                const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
                if (!whatsapp || !whatsapp.number) {
                  console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                  throw new Error('Número de WhatsApp não encontrado');
                }
                const botNumber = whatsapp.number;

                const buttons = [];

                queues.forEach((queue, index) => {
                  buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: queue.name,
                      id: `${index + 1}`
                    }),
                  });
                });

                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: "Encerrar atendimento",
                    id: "Sair"
                  }),
                });

                // Verifica se há uma mídia para enviar
                if (ticket.whatsapp.greetingMediaAttachment) {
                  const filePath = path.resolve("public", `company${companyId}`, ticket.whatsapp.greetingMediaAttachment);
                  const fileExists = fs.existsSync(filePath);

                  if (fileExists) {
                    // Carrega a imagem local
                    const imageMessageContent = await generateWAMessageContent(
                      { image: { url: filePath } }, // Caminho da imagem local
                      { upload: wbot.waUploadToServer! }
                    );
                    const imageMessage = imageMessageContent.imageMessage;

                    // Mensagem interativa com mídia
                    const interactiveMsg = {
                      viewOnceMessage: {
                        message: {
                          interactiveMessage: {
                            body: {
                              text: `\u200e${greetingMessage}`,
                            },
                            header: {
                              imageMessage,  // Anexa a imagem
                              hasMediaAttachment: true
                            },
                            nativeFlowMessage: {
                              buttons: buttons,
                              messageParamsJson: JSON.stringify({
                                from: 'apiv2',
                                templateId: '4194019344155670',
                              }),
                            },
                          },
                        },
                      },
                    };

                    const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
                    const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
                    await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

                    if (newMsg) {
                      await wbot.upsertMessage(newMsg, 'notify');
                    }
                  }
                }
              } catch (error) {
                console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
              }
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentButton = debounce(
            async () => {
              try {
                const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
                if (!whatsapp || !whatsapp.number) {
                  console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                  throw new Error('Número de WhatsApp não encontrado');
                }
                const botNumber = whatsapp.number;

                const buttons = [];

                queues.forEach((queue, index) => {
                  buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: queue.name,
                      id: `${index + 1}`
                    }),
                  });
                });

                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: "Encerrar atendimento",
                    id: "Sair"
                  }),
                });

                const interactiveMsg = {
                  viewOnceMessage: {
                    message: {
                      interactiveMessage: {
                        body: {
                          text: `\u200e${greetingMessage}`,
                        },
                        nativeFlowMessage: {
                          buttons: buttons,
                          messageParamsJson: JSON.stringify({
                            from: 'apiv2',
                            templateId: '4194019344155670',
                          }),
                        },
                      },
                    },
                  },
                };

                const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
                const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
                await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

                if (newMsg) {
                  await wbot.upsertMessage(newMsg, 'notify');
                }
              } catch (error) {
                console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
              }
            },
            1000,
            ticket.id
          );

          debouncedSentButton();
        }


        await UpdateTicketService({
          ticketData: {
          },
          ticketId: ticket.id,
          companyId
        });

        return
      } else {


        const debouncedSentButton = debounce(
          async () => {
            try {
              const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
              if (!whatsapp || !whatsapp.number) {
                console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                throw new Error('Número de WhatsApp não encontrado');
              }
              const botNumber = whatsapp.number;

              const buttons = [];

              queues.forEach((queue, index) => {
                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: queue.name,
                    id: `${index + 1}`
                  }),
                });
              });

              buttons.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: "Encerrar atendimento",
                  id: "Sair"
                }),
              });

              const interactiveMsg = {
                viewOnceMessage: {
                  message: {
                    interactiveMessage: {
                      body: {
                        text: `\u200e${greetingMessage}`,
                      },
                      nativeFlowMessage: {
                        buttons: buttons,
                        messageParamsJson: JSON.stringify({
                          from: 'apiv2',
                          templateId: '4194019344155670',
                        }),
                      },
                    },
                  },
                },
              };

              const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
              const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
              await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

              if (newMsg) {
                await wbot.upsertMessage(newMsg, 'notify');
              }
            } catch (error) {
              console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
            }
          },
          1000,
          ticket.id
        );



        await UpdateTicketService({
          ticketData: {

          },
          ticketId: ticket.id,
          companyId
        });
        debouncedSentButton();
      }
    }
  };

  if (typeBot === "text") {
    return botText();
  }

  if (typeBot === "list") {
    return botList();
  }

  if (typeBot === "button") {
    return botButton();
  }

  if (typeBot === "button" && queues.length > 3) {
    return botText();
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.closedAt !== null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt === null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();
  const companyId = ticket.companyId;


  // console.log("GETTING WHATSAPP HANDLE RATING", ticket.whatsappId, ticket.id)
  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,

    companyId
  );

  let finalRate = rate;

  if (rate < 0) {
    finalRate = 0;
  }
  if (rate > 10) {
    finalRate = 10;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (
    !isNil(complationMessage) &&
    complationMessage !== "" &&
    !ticket.isGroup
  ) {
    const body = formatBody(`\u200e${complationMessage}`, ticket);
    if (ticket.channel === "whatsapp") {
      const msg = await SendWhatsAppMessage({ body, ticket });

      await verifyMessage(msg, ticket, ticket.contact, ticketTraking, undefined, false, false, undefined);
    }

    if (["facebook", "instagram"].includes(ticket.channel)) {
      await sendFaceMessage({ body, ticket });
    }
  }

  await ticket.update({
    isBot: false,
    status: "closed",
    amountUsedBotQueuesNPS: 0
  });

  //loga fim de atendimento
  await CreateLogTicketService({
    userId: ticket.userId,
    queueId: ticket.queueId,
    ticketId: ticket.id,
    type: "closed"
  });

  // Recarrega ticket com associações para emitir evento Socket.IO completo
  ticket = await ShowTicketService(ticket.id, companyId);

  // CQRS: Emitir eventos via TicketEventBus (oldStatus=nps pois ticket saiu de avaliação)
  ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, "nps");
  ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const convertTextToSpeechAndSaveToFile = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  audioToFormat: string = "mp3"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    );
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result) {
          convertWavToAnotherFormat(
            `${filename}.wav`,
            `${filename}.${audioToFormat}`,
            audioToFormat
          )
            .then(output => {
              resolve();
            })
            .catch(error => {
              console.error(error);
              reject(error);
            });
        } else {
          reject(new Error("No result from synthesizer"));
        }
        synthesizer.close();
      },
      error => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertWavToAnotherFormat = (
  inputPath: string,
  outputPath: string,
  toFormat: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .toFormat(toFormat)
      .on("end", () => resolve(outputPath))
      .on("error", (err: { message: any }) =>
        reject(new Error(`Error converting file: ${err.message}`))
      )
      .save(outputPath);
  });
};

export const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g, "");
};

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  // Quando a IA decide transferir (via "Ação: Transferir para o setor de atendimento"),
  // tiramos o ticket do modo bot e colocamos em "pending" na fila indicada,
  // para que um atendente humano possa assumi-lo normalmente.
  await UpdateTicketService({
    ticketData: {
      queueId: queueId,
      status: "pending",
      isBot: false
    },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);

  /*
  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: Number(String(msg.status).replace('PENDING', '2').replace('NaN', '1')) || 2,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
  };


  await CreateMessageService({ messageData, companyId: ticket.companyId });

  */

  if (!msg.key.fromMe && ticket.status === "closed") {

    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
    await UpdateTicketService({
      ticketData: { status: "pending", integrationId: ticket.integrationId },
      ticketId: ticket.id,
      companyId
    });

    // Eventos Socket.IO já emitidos pelo UpdateTicketService via TicketEventBus
  }

  if (msg.key.fromMe) {
    return;
  }

  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  if (
    !isFirstMsg &&
    listPhrase.filter(item => item.phrase === body).length === 0
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdWelcome
      }
    });
    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // // Enviar as variáveis como parte da mensagem para o Worker
      // console.log('DISPARO1')
      // const data = {
      //   idFlowDb: flowUse.flowIdWelcome,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: flow.flow["nodes"][0].id,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: null,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdWelcome,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  const dateTicket = new Date(
    isFirstMsg?.updatedAt ? isFirstMsg.updatedAt : ""
  );
  const dateNow = new Date();
  const diferencaEmMilissegundos = Math.abs(
    differenceInMilliseconds(dateTicket, dateNow)
  );
  const seisHorasEmMilissegundos = 1000;

  if (
    listPhrase.filter(item => item.phrase === body).length === 0 &&
    diferencaEmMilissegundos >= seisHorasEmMilissegundos &&
    isFirstMsg
  ) {

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdNotPhrase,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  // Campaign fluxo
  if (listPhrase.filter(item => item.phrase === body).length !== 0) {
    const flowDispar = listPhrase.filter(item => item.phrase === body)[0];
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    //const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

    //console.log('DISPARO3')
    // Enviar as variáveis como parte da mensagem para o Worker
    // const data = {
    //   idFlowDb: flowDispar.flowId,
    //   companyId: ticketUpdate.companyId,
    //   nodes: nodes,
    //   connects: connections,
    //   nextStage: flow.flow["nodes"][0].id,
    //   dataWebhook: null,
    //   details: "",
    //   hashWebhookId: "",
    //   pressKey: null,
    //   idTicket: ticketUpdate.id,
    //   numberPhrase: mountDataContact
    // };
    // worker.postMessage(data);

    // worker.on("message", message => {
    //   console.log(`Mensagem do worker: ${message}`);
    // });

    await ActionsWebhookService(
      whatsapp.id,
      flowDispar.flowId,
      ticket.companyId,
      nodes,
      connections,
      flow.flow["nodes"][0].id,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );
    return;
  }

  if (ticket.flowWebhook) {
    const webhook = await WebhookModel.findOne({
      where: {
        company_id: ticket.companyId,
        hash_id: ticket.hashFlowId
      }
    });

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO4')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: webhook.config["details"].idFlow,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: ticketUpdate.dataWebhook,
      //   details: webhook.config["details"],
      //   hashWebhookId: ticketUpdate.hashFlowId,
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: ""
      // };
      // worker.postMessage(data);

      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        body,
        ticket.id
      );
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO5')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: parseInt(ticketUpdate.flowStopped),
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }
};
export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  isMenu: boolean,
  whatsapp: Whatsapp,
  contact: Contact,
  isFirstMsg: Ticket | null
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: msg
      };
      try {
        request(options, function (error, response) {
          if (error) {
            throw new Error(error);
          } else {
            console.log(response.body);
          }
        });
      } catch (error) {
        throw new Error(error);
      }
    }
  } else if (queueIntegration.type === "dialogflow") {
    let inputAudio: string | undefined;

    if (msgType === "audioMessage") {
      let filename = `${msg.messageTimestamp}.ogg`;
      readFile(
        join(
          __dirname,
          "..",
          "..",
          "..",
          "public",
          `company${companyId}`,
          filename
        ),
        "base64",
        (err, data) => {
          inputAudio = data;
          if (err) {
            logger.error(err);
          }
        }
      );
    } else {
      inputAudio = undefined;
    }

    const debouncedSentMessage = debounce(
      async () => {
        await sendDialogflowAwswer(
          wbot,
          ticket,
          msg,
          ticket.contact,
          inputAudio,
          companyId,
          queueIntegration
        );
      },
      500,
      ticket.id
    );
    debouncedSentMessage();
  } else if (queueIntegration.type === "typebot") {
    // await typebots(ticket, msg, wbot, queueIntegration);
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  } else if (queueIntegration.type === "flowbuilder") {
    if (!isMenu) {
      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );
      await flowbuilderIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        contact,
        isFirstMsg
      );
    } else {
      if (
        !isNaN(parseInt(ticket.lastMessage)) &&
        ticket.status !== "open" &&
        ticket.status !== "closed"
      ) {
        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
      }
    }
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  const body = getBodyMessage(msg);

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped
    }
  });

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  if (
    ticket.status === "closed" ||
    ticket.status === "interrupted" ||
    ticket.status === "open"
  ) {
    return;
  }

  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    msg
  );

  //const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  //await handleMessageIntegration(msg, wbot, companyId, integrations, ticket, contact, isFirstMsg)
};

const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  isImported: boolean = false
): Promise<void> => {

  if (!isValidMsg(msg)) {
    return;
  }

  try {
    let groupContact: Contact | undefined;
    let queueId: number = null;
    let tagsId: number = null;
    let userId: number = null;

    let bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    // TRATAMENTO DE REAÇÕES (ReactionMessage) - Versão compatível com Frontend
    if (msgType === "reactionMessage") {
      const reactionContent = msg.message?.reactionMessage?.text;
      const targetQuotedId = msg.message?.reactionMessage?.key?.id;

      if (!targetQuotedId) return;

      // 1. Verificar se a mensagem alvo existe
      const targetMessage = await Message.findOne({
        where: { wid: targetQuotedId, companyId }
      });

      if (!targetMessage) {
        logger.warn(`[handleMessage] Reação ignorada: Mensagem alvo ${targetQuotedId} não encontrada no banco.`);
        return;
      }

      // 2. Unicidade: Se este usuário já reagiu a esta mensagem, remover a reação antiga
      const senderJid = msg.key.participant || msg.key.remoteJid;
      const oldReaction = await Message.findOne({
        where: {
          quotedMsgId: targetMessage.id, // ID interno
          participant: senderJid,
          mediaType: "reactionMessage",
          companyId
        }
      });

      if (oldReaction) {
        await oldReaction.destroy();
        // Emitir delete via MessageEventBus (usa UUID do ticket, não ID numérico)
        const reactionTicket = await Ticket.findByPk(targetMessage.ticketId, { attributes: ["id", "uuid"] });
        if (reactionTicket) {
          messageEventBus.publishMessageDeleted(
            companyId,
            reactionTicket.id,
            reactionTicket.uuid,
            oldReaction.id
          );
        }
      }

      // 3. Se reactionContent for vazio, significa que a reação foi removida no WhatsApp
      if (!reactionContent) {
        return; // Já destruímos e emitimos o delete acima
      }

      // 4. Continuar para o fluxo normal de criação (que usará verifyMessage)
      // Mas vamos injetar os dados necessários para o verifyMessage funcionar perfeitamente
    }

    const hasMedia =
      msg.message?.imageMessage ||
      msg.message?.audioMessage ||
      msg.message?.videoMessage ||
      msg.message?.stickerMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.documentMessage ||
      msg.message?.ephemeralMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.stickerMessage ||
      msg.message?.ephemeralMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.imageMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
      msg.message?.interactiveMessage?.header?.imageMessage ||
      msg.message?.interactiveMessage?.header?.documentMessage ||
      msg.message?.interactiveMessage?.header?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.documentMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.imageMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.locationMessage;

    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "contactMessage" &&
        msgType !== "reactionMessage" &&
        msgType !== "ephemeralMessage" &&
        msgType !== "protocolMessage" &&
        msgType !== "viewOnceMessage" &&
        msgType !== "editedMessage" &&
        msgType !== "hydratedContentText"
      )
        return;
    }

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

    if (!whatsapp.allowGroup && isGroup) return;

    // Buscar configurações da empresa
    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    });

    // NOVA FUNCIONALIDADE: Verificar se captura automática de contatos de grupos está habilitada
    const autoCaptureGroupContacts = settings?.autoCaptureGroupContacts === "enabled";

    // ═══════════════════════════════════════════════════════════════
    // FLUXO RESTAURADO: getContactMessage + verifyContact
    // Mantém compatibilidade com fluxo antigo (funcional) e usa melhorias
    // de resolução de LID já incorporadas no getContactMessage atual
    // ═══════════════════════════════════════════════════════════════

    let msgContact: IMe;

    // Extrair contato da mensagem (já inclui lógica de remoteJidAlt/participantAlt)
    msgContact = await getContactMessage(msg, wbot);

    if (isGroup) {
      // Para grupos, precisamos garantir que o contato do GRUPO exista
      const groupJid = msg.key.remoteJid;
      let groupSubject = getFallbackGroupName(groupJid);

      // Tentar obter nome do grupo do cache ou metadados
      const cachedMetadata = getGroupMetadataFromCache(groupJid);
      if (cachedMetadata) {
        groupSubject = cachedMetadata.subject || groupSubject;
      } else if (!shouldBackoffGroupMetadata(groupJid)) {
        try {
          const grupoMeta = await wbot.groupMetadata(groupJid);
          groupSubject = grupoMeta?.subject || groupSubject;
          setGroupMetadataCache(groupJid, groupSubject);
        } catch (error) {
          // Ignorar erros de metadados, usar JID como nome
        }
      }

      const msgGroupContact = {
        id: groupJid,
        name: groupSubject
      };

      try {
        groupContact = await verifyContact(msgGroupContact, wbot, companyId, userId);
      } catch (e) {
        logger.error({ err: e, groupJid }, "[handleMessage] Falha crítica ao verificar contato do grupo");
        return; // Sem grupo, não podemos criar ticket
      }
    }

    // CONTROLE DE CAPTURA AUTOMÁTICA DE CONTATOS DE GRUPOS
    let contact: Contact | null = null;

    // Tentar verificar/criar o contato do participante/remetente
    try {
      if (isGroup && !autoCaptureGroupContacts) {
        // Se captura automática está DESABILITADA, apenas buscar contato existente
        const participantJid = msg.participant || msg.key.participant;
        if (participantJid) {
          const normalizedParticipantJid = jidNormalizedUser(participantJid);
          const participantNumber = normalizedParticipantJid.replace(/\D/g, "");
          const isLidParticipant = participantJid.includes("@lid");

          contact = await Contact.findOne({
            where: {
              companyId,
              isGroup: false,
              [Op.or]: [
                { canonicalNumber: participantNumber },
                { number: participantNumber },
                ...(isLidParticipant ? [{ lidJid: normalizedParticipantJid }, { remoteJid: normalizedParticipantJid }] : [])
              ]
            }
          });

          if (contact) {
            logger.info("[handleMessage] Participante de grupo já cadastrado (captura auto OFF), processando.", {
              contactId: contact.id
            });
          }
        }
      } else {
        // Fluxo normal: verificar e criar contato se necessário
        contact = await verifyContact(msgContact, wbot, companyId, userId);
      }
    } catch (e) {
      logger.error({ err: e, msgContact }, "[handleMessage] Erro no verifyContact");
    }

    // FALLBACK CRÍTICO: Se não encontrou contato do participante em grupo, usar o do grupo
    // Isso garante que a mensagem SEMPRE seja salva no ticket do grupo
    if (!contact && isGroup && groupContact) {
      contact = groupContact;
      logger.info("[handleMessage] Usando contato do grupo como fallback (participante não encontrado/criado)");
    }

    // Se ainda assim não tiver contato, falhar com erro (não descartar silenciosamente)
    if (!contact) {
      logger.error('[handleMessage] ERRO CRÍTICO: Contato não encontrado nem criado', {
        remoteJid: msg.key.remoteJid,
        isGroup,
        msgContact
      });
      return;
    }

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const enableLGPD = settings?.enableLGPD === "enabled";

    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    // Usa mutex global compartilhado para evitar race conditions na criação de tickets
    const mutex = getTicketMutex(companyId);
    console.log(`[wbotMessageListener] Processando mensagem para companyId=${companyId}, contactId=${contact.id}, mutex=${mutex ? "ativo" : "inativo"}`);

    let ticket = await mutex.runExclusive(async () => {
      console.log(`[wbotMessageListener] Dentro do mutex - criando/buscando ticket para contactId=${contact.id}`);
      const result = await FindOrCreateTicketService(
        contact,
        whatsapp,
        unreadMessages,
        companyId,
        queueId,
        userId,
        groupContact,
        "whatsapp",
        isImported,
        false,
        settings,
        false,
        false,
        Boolean(msg?.key?.fromMe)
      );
      console.log(`[wbotMessageListener] Ticket obtido: id=${result.id}, uuid=${result.uuid}, status=${result.status}`);
      return result;
    }).catch(err => {
      // Fallback em caso de timeout do mutex
      if (err?.message === 'mutex timeout' || err?.code === 'E_TIMEOUT') {
        logger.warn(`[wbotMessageListener] Mutex timeout para companyId=${companyId} - Executando sem lock`);
        return FindOrCreateTicketService(
          contact,
          whatsapp,
          unreadMessages,
          companyId,
          queueId,
          userId,
          groupContact,
          "whatsapp",
          isImported,
          false,
          settings,
          false,
          false,
          Boolean(msg?.key?.fromMe)
        );
      }
      throw err;
    });

    // Se o ticket está em status "campaign" e o contato respondeu, mover para fluxo normal
    if (ticket.status === "campaign" && !msg.key.fromMe) {
      logger.info(`[wbotMessageListener] Contato respondeu em ticket de campanha #${ticket.id}, movendo para fluxo normal. Fila: ${ticket.queueId}`);

      // Regra de saída de campanha:
      // - Se a fila/conexão tem bot/IA configurado (ticket.isBot === true) => vai para BOT
      // - Caso contrário => vai para AGUARDANDO (pending)
      let newStatus = "pending";
      if (ticket.isBot) {
        newStatus = "bot";
      }

      // BUG-31 fix: Não incrementar unreadMessages aqui — FindOrCreateTicketService já atualizou
      await ticket.update({
        status: newStatus
      });

      // Recarregar ticket com include completo (inclui queue.chatbots e queue.prompt)
      ticket = await ShowTicketService(ticket.id, companyId);

      logger.info(`[wbotMessageListener] Ticket #${ticket.id} movido para status "${newStatus}", fila: ${ticket.queueId}`);
    }

    let bodyRollbackTag = "";
    let bodyNextTag = "";
    let rollbackTag;
    let nextTag;
    let ticketTag = undefined;
    // console.log(ticket.id)
    if (ticket?.company?.plan?.useKanban) {
      ticketTag = await TicketTag.findOne({
        where: {
          ticketId: ticket.id
        }
      });

      if (ticketTag) {
        const tag = await Tag.findByPk(ticketTag.tagId);
        if (tag.nextLaneId) {
          nextTag = await Tag.findByPk(tag.nextLaneId);
          bodyNextTag = nextTag.greetingMessageLane;
        }
        if (tag.rollbackLaneId) {
          rollbackTag = await Tag.findByPk(tag.rollbackLaneId);
          bodyRollbackTag = rollbackTag.greetingMessageLane;
        }
      }
    }

    if (
      (ticket.status === "closed" && !isGroup) ||
      (unreadMessages === 0 &&
        !isGroup &&
        whatsapp.complationMessage &&
        formatBody(whatsapp.complationMessage, ticket) === bodyMessage)
    ) {
      return;
    }

    if (
      rollbackTag &&
      formatBody(bodyNextTag, ticket) !== bodyMessage &&
      formatBody(bodyRollbackTag, ticket) !== bodyMessage
    ) {
      await TicketTag.destroy({
        where: { ticketId: ticket.id, tagId: ticketTag.tagId }
      });
      await TicketTag.create({ ticketId: ticket.id, tagId: rollbackTag.id });
    }

    if (isImported) {
      await ticket.update({
        queueId: whatsapp.queueIdImportMessages
      });
    }

    // console.log(msg.message?.editedMessage)
    // console.log(ticket)
    if (msgType === "editedMessage" || msgType === "protocolMessage") {
      const msgKeyIdEdited =
        msgType === "editedMessage"
          ? msg.message.editedMessage.message.protocolMessage.key.id
          : msg.message?.protocolMessage.key.id;
      let bodyEdited = getBodyMessage(msg);


      // console.log("bodyEdited", bodyEdited)
      const io = getIO();
      try {
        const messageToUpdate = await Message.findOne({
          where: {
            wid: msgKeyIdEdited,
            companyId,
            ticketId: ticket.id
          }
        });

        if (!messageToUpdate) return;

        await messageToUpdate.update({ isEdited: true, body: bodyEdited });

        await ticket.update({ lastMessage: bodyEdited });


        // Emitir update da mensagem editada via MessageEventBus (com broadcast)
        messageEventBus.publishMessageUpdated(companyId, ticket.id, ticket.uuid, messageToUpdate.id, messageToUpdate);

        // CQRS: Emitir evento de ticket via TicketEventBus (atualiza lastMessage na lista)
        ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Error handling message ack. Err: ${err}`);
      }
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      userId,
      whatsappId: whatsapp?.id,
      queueId: ticket.queueId
    });

    let useLGPD = false;

    try {
      if (!msg.key.fromMe) {
        //MENSAGEM DE FÉRIAS COLETIVAS


        if (!isNil(whatsapp.collectiveVacationMessage && !isGroup)) {
          const currentDate = moment();


          if (
            currentDate.isBetween(
              moment(whatsapp.collectiveVacationStart),
              moment(whatsapp.collectiveVacationEnd)
            )
          ) {

            if (hasMedia) {

              await verifyMediaMessage(
                msg,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            } else {
              await verifyMessage(msg, ticket, contact, ticketTraking, undefined, false, false, wbot);
            }

            wbot.sendMessage(contact.remoteJid, {
              text: whatsapp.collectiveVacationMessage
            });

            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const isMsgForwarded =
      msg.message?.extendedTextMessage?.contextInfo?.isForwarded ||
      msg.message?.imageMessage?.contextInfo?.isForwarded ||
      msg.message?.audioMessage?.contextInfo?.isForwarded ||
      msg.message?.videoMessage?.contextInfo?.isForwarded ||
      msg.message?.documentMessage?.contextInfo?.isForwarded;

    let mediaSent: Message | undefined;

    if (!useLGPD) {
      if (hasMedia) {
        mediaSent = await verifyMediaMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          isMsgForwarded,
          false,
          wbot
        );
      } else {
        // console.log("antes do verifyMessage")
        await verifyMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          false,
          isMsgForwarded,
          false,
          wbot
        );
      }
    }

    try {
      if (!msg.key.fromMe) {
        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          handleRating(parseFloat(bodyMessage), ticket, ticketTraking);
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    let currentSchedule;

    if (settings.scheduleType === "company") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
    } else if (settings.scheduleType === "connection") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
    }

    try {
      if (
        !msg.key.fromMe &&
        settings.scheduleType &&
        (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
        !["open", "group"].includes(ticket.status)
      ) {
        /**
         * Tratamento para envio de mensagem quando a empresa está fora do expediente
         */
        if (
          (settings.scheduleType === "company" ||
            settings.scheduleType === "connection") &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          if (
            whatsapp.maxUseBotQueues &&
            whatsapp.maxUseBotQueues !== 0 &&
            ticket.amountUsedBotQueues >= whatsapp.maxUseBotQueues
          ) {
            // await UpdateTicketService({
            //   ticketData: { queueId: queues[0].id },
            //   ticketId: ticket.id
            // });

            return;
          }

          if (whatsapp.timeUseBotQueues !== "0") {
            if (
              ticket.isOutOfHour === false &&
              ticketTraking.chatbotAt !== null
            ) {
              await ticketTraking.update({
                chatbotAt: null
              });
              await ticket.update({
                amountUsedBotQueues: 0
              });
            }

            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
            let dataLimite = new Date();
            let Agora = new Date();

            if (ticketTraking.chatbotAt !== null) {
              dataLimite.setMinutes(
                ticketTraking.chatbotAt.getMinutes() +
                Number(whatsapp.timeUseBotQueues)
              );
              if (
                ticketTraking.chatbotAt !== null &&
                Agora < dataLimite &&
                whatsapp.timeUseBotQueues !== "0" &&
                ticket.amountUsedBotQueues !== 0
              ) {
                return;
              }
            }

            await ticketTraking.update({
              chatbotAt: null
            });
          }

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          });

          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }



    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;

    if (flow) {
      isMenu =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "question";
    }

    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      console.log(
        "|============= QUESTION =============|",
        JSON.stringify(flow, null, 4)
      );
      const body = getBodyMessage(msg);
      if (body) {
        const nodes: INodes[] = flow.flow["nodes"];
        const nodeSelected = flow.flow["nodes"].find(
          (node: any) => node.id === ticket.lastFlowId
        );

        const connections: IConnections[] = flow.flow["connections"];

        const { message, answerKey } = nodeSelected.data.typebotIntegration;
        const oldDataWebhook = ticket.dataWebhook;

        const nodeIndex = nodes.findIndex(node => node.id === nodeSelected.id);

        const lastFlowId = nodes[nodeIndex + 1].id;
        await ticket.update({
          lastFlowId: lastFlowId,
          dataWebhook: {
            variables: {
              [answerKey]: body
            }
          }
        });

        await ticket.save();

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          lastFlowId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }

      return;
    }


    if (isOpenai && !isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );

      if (!nodeSelected?.data?.typebotIntegration) {
        console.error("typebotIntegration not found in nodeSelected");
        return;
      }

      const {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens,
        temperature,
        apiKey,
        queueId,
        maxMessages,
        model // <- Aqui está o campo ausente
      } = nodeSelected.data.typebotIntegration as IOpenAi;

      const openAiSettings = {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens: Number(maxTokens) || 0,
        temperature: Number(temperature) || 0,
        apiKey,
        queueId: Number(queueId) || 0,
        maxMessages: Number(maxMessages) || 0,
        model
      };

      await handleOpenAi(
        openAiSettings,
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking
      );

      return;
    }




    //openai na conexao
    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      const { prompt } = whatsapp;
      await handleOpenAi(
        prompt,
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking
      );
    }

    //integraçao na conexao
    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      ticket.isBot &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {
      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
      return;
    }

    // integração flowbuilder
    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );
      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    if (
      !isNil(ticket.typebotSessionId) &&
      ticket.typebotStatus &&
      !msg.key.fromMe &&
      !isNil(ticket.typebotSessionTime) &&
      ticket.useIntegration
    ) {
      console.log("|================== CONTINUE TYPEBO ==============|");
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const lastFlow = nodes.find(f => f.id === ticket.lastFlowId);
      const typebot = lastFlow.data.typebotIntegration;

      await typebotListener({
        wbot: wbot,
        msg,
        ticket,
        typebot: lastFlow.data.typebotIntegration
      });
      return;
    }

    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration
    ) {
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        null,
        null,
        contact,
        null
      );

      if (msg.key.fromMe) {
        await ticket.update({
          typebotSessionTime: moment().toDate()
        });
      }
    }

    if (
      !ticket.imported &&
      !ticket.queue &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      // console.log("antes do verifyqueue")
      await verifyQueue(wbot, msg, ticket, contact, settings, ticketTraking);

      if (ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    if (ticket.queueId > 0) {
      await ticketTraking.update({
        queueId: ticket.queueId
      });
    }

    // Verificação se aceita audio do contato
    if (
      getTypeMessage(msg) === "audioMessage" &&
      !msg.key.fromMe &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      (!contact?.acceptAudioMessage ||
        settings?.acceptAudioMessageContact === "disabled")
    ) {
      const sentMessage = await wbot.sendMessage(
        `${contact.number}@c.us`,
        {
          text: `\u200e*Assistente Virtual*:\nInfelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de *texto*.`
        },
        {
          quoted: {
            key: msg.key,
            message: {
              extendedTextMessage: msg.message.extendedTextMessage
            }
          }
        }
      );
      await verifyMessage(sentMessage, ticket, contact, ticketTraking, undefined, false, false, wbot);
    }

    try {
      if (
        !msg.key.fromMe &&
        settings?.scheduleType &&
        ticket.queueId !== null &&
        (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
        ticket.status !== "open"
      ) {
        /**
         * Tratamento para envio de mensagem quando a empresa/fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);

        if (settings?.scheduleType === "queue") {
          currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
        }

        if (
          settings?.scheduleType === "queue" &&
          !isNil(currentSchedule) &&
          ticket.amountUsedBotQueues < whatsapp.maxUseBotQueues &&
          (!currentSchedule || currentSchedule.inActivity === false) &&
          !ticket.imported
        ) {
          if (Number(whatsapp.timeUseBotQueues) > 0) {
            if (
              ticket.isOutOfHour === false &&
              ticketTraking.chatbotAt !== null
            ) {
              await ticketTraking.update({
                chatbotAt: null
              });
              await ticket.update({
                amountUsedBotQueues: 0
              });
            }

            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
            let dataLimite = new Date();
            let Agora = new Date();

            if (ticketTraking.chatbotAt !== null) {
              dataLimite.setMinutes(
                ticketTraking.chatbotAt.getMinutes() +
                Number(whatsapp.timeUseBotQueues)
              );

              if (
                ticketTraking.chatbotAt !== null &&
                Agora < dataLimite &&
                whatsapp.timeUseBotQueues !== "0" &&
                ticket.amountUsedBotQueues !== 0
              ) {
                return;
              }
            }

            await ticketTraking.update({
              chatbotAt: null
            });
          }

          const outOfHoursMessage = queue.outOfHoursMessage;

          if (outOfHoursMessage !== "") {
            // console.log("entrei2");
            const body = formatBody(`${outOfHoursMessage}`, ticket);

            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              1000,
              ticket.id
            );
            debouncedSentMessage();
          }
          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          });
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    // Fallback: se o ticket tem queueId mas não veio com a associação carregada,
    // recarrega para garantir queue.chatbots e queue.prompt e permitir disparo do bot/IA.
    if (ticket.queueId && !ticket.queue) {
      try {
        ticket = await ShowTicketService(ticket.id, companyId);
      } catch (e) {
        // silencioso: se falhar, mantém como está
      }
    }

    if (ticket.queue && ticket.queueId && !msg.key.fromMe) {
      // CRÍTICO: Respeitar desativação do bot por contato (toggle "Desabilitar chatbot")
      if ((contact as any)?.disableBot) {
        return;
      }

      // CRÍTICO: Bot/IA só pode responder quando o ticket estiver na aba BOT
      // (status=bot). Se saiu da aba BOT, para imediatamente.
      if (ticket.status !== "bot") {
        return;
      }

      const hasChatbot = Boolean(ticket.queue?.chatbots && ticket.queue.chatbots.length > 0);
      const queuePrompt = (ticket.queue as any)?.prompt;
      const hasPrompt = Boolean(queuePrompt && Array.isArray(queuePrompt) && queuePrompt.length > 0);

      if (hasChatbot && (!ticket.user || ticket.queue?.chatbots?.length > 0)) {
        await sayChatbot(
          ticket.queueId,
          wbot,
          ticket,
          contact,
          msg,
          ticketTraking
        );
      } else if (ticket.isBot && hasPrompt) {
        try {
          await handleOpenAi(
            queuePrompt[0],
            msg,
            wbot,
            ticket,
            contact,
            mediaSent,
            ticketTraking
          );
        } catch (e) {
          Sentry.captureException(e);
          logger.error(`[wbotMessageListener] Erro ao processar IA por Prompt da fila. ticketId=${ticket.id}; queueId=${ticket.queueId}; err=${(e as any)?.message || e}`);
        }
      } else if (ticket.isBot && !hasPrompt) {
        // Agent-only: quando existe AIAgent na fila mas não há Prompt legado, ainda assim precisamos disparar a IA.
        // handleOpenAi resolve o AIAgent automaticamente a partir do ticket.queueId.
        try {
          await handleOpenAi(
            undefined as any,
            msg,
            wbot,
            ticket,
            contact,
            mediaSent,
            ticketTraking
          );
        } catch (e) {
          Sentry.captureException(e);
          logger.error(`[wbotMessageListener] Erro ao processar IA por AIAgent (sem prompt). ticketId=${ticket.id}; queueId=${ticket.queueId}; err=${(e as any)?.message || e}`);
        }
      }

      //atualiza mensagem para indicar que houve atividade e aí contar o tempo novamente para enviar mensagem de inatividade
      await ticket.update({
        sendInactiveMessage: false
      });
    }

    await ticket.reload();
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};
const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));

  try {
    // CQRS: Usar MessageCommandService para atualizar ACK
    // Isso já faz: busca mensagem + valida ack + update DB + emite evento via EventBus
    const { updateMessageAckByWid } = await import("../MessageServices/MessageCommandService");
    const wid = msg.key.id;

    if (!wid || chat === null || chat === undefined) {
      return;
    }

    const updatedMessage = await updateMessageAckByWid(wid, chat);

    if (updatedMessage) {
      console.log(`[handleMsgAck] ACK atualizado via CQRS: msgId=${updatedMessage.id} ack=${chat}`);
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyRecentCampaign = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  if (!isValidMsg(message)) {
    return;
  }
  if (!message.key.fromMe) {
    const number = message.key.remoteJid.replace(/\D/g, "");
    const campaigns = await Campaign.findAll({
      where: { companyId, status: "EM_ANDAMENTO", confirmation: true }
    });
    if (campaigns) {
      const ids = campaigns.map(c => c.id);
      const campaignShipping = await CampaignShipping.findOne({
        where: {
          campaignId: { [Op.in]: ids },
          number,
          confirmation: null,
          deliveredAt: { [Op.ne]: null }
        }
      });

      if (campaignShipping) {
        await campaignShipping.update({
          confirmedAt: moment(),
          confirmation: true
        });
        await campaignQueue.add(
          "DispatchCampaign",
          {
            campaignShippingId: campaignShipping.id,
            campaignId: campaignShipping.campaignId
          },
          {
            delay: parseToMilliseconds(randomValue(0, 10))
          }
        );
      }
    }
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number,
  wbot: Session
) => {
  if (!isValidMsg(message)) {
    return;
  }

  const io = getIO();
  const body = await getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);

  if (message.key.fromMe && isCampaign) {
    const campaignResolution = await resolveMessageContact(message, wbot, companyId);
    const contact = campaignResolution?.contact;

    const messageRecord = await Message.findOne({
      where: {
        [Op.or]: [{ wid: message.key.id! }, { contactId: contact.id }],
        companyId
      }
    });

    if (
      !isNull(messageRecord) ||
      !isNil(messageRecord) ||
      messageRecord !== null
    ) {
      const ticket = await Ticket.findByPk(messageRecord.ticketId);
      if (ticket) {
        const oldStatus = ticket.status;
        await ticket.update({ status: "closed", amountUsedBotQueues: 0 });

        // CQRS: Emitir via TicketEventBus para broadcast
        ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, oldStatus);
        ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
      }
    }
  }
};

const filterMessages = (msg: WAMessage): boolean => {
  msgDB.save(msg);

  if (msg.message?.protocolMessage?.editedMessage) return true;
  if (msg.message?.protocolMessage) return false;

  // Filtrar mensagens que falharam na decriptação (Bad MAC / No matching sessions)
  // messageStubType=2 (CIPHERTEXT) indica erro de sessão criptográfica
  // Processar essas mensagens cria contatos PENDING_ fantasma
  if (msg.messageStubType === WAMessageStubType.CIPHERTEXT) {
    logger.warn({
      msgId: msg.key?.id,
      remoteJid: msg.key?.remoteJid,
      fromMe: msg.key?.fromMe,
      stubParams: msg.messageStubParameters
    }, "[filterMessages] Mensagem CIPHERTEXT (erro decriptação) descartada");
    return false;
  }

  if (
    [
      WAMessageStubType.REVOKE,
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED
    ].includes(msg.messageStubType as number)
  )
    return false;

  return true;
};

const wbotMessageListener = (wbot: Session, companyId: number): void => {
  const wbotUserJid = wbot?.user?.id;
  wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
    // Phase 4: Diferenciar tipo de mensagem (notify = tempo real, append/historical = histórico)
    const upsertType = (messageUpsert as any).type || "unknown";
    const isRealtime = upsertType === "notify";

    if (isRealtime) {
      logger.info(`[messages.upsert] REALTIME (notify) - ${messageUpsert.messages.length} mensagem(s) | companyId=${companyId}`);
    } else {
      // IGNORAR mensagens históricas - elas são processadas pelo ImportWhatsAppMessageService
      logger.debug(`[messages.upsert] IGNORANDO HISTÓRICO (${upsertType}) - ${messageUpsert.messages.length} mensagem(s) | companyId=${companyId}`);
      return;
    }

    const messages = messageUpsert.messages
      .filter(filterMessages)
      .map(msg => msg);

    if (!messages) return;

    // console.log("CIAAAAAAA WBOT " , companyId)
    messages.forEach(async (message: proto.IWebMessageInfo) => {
      if (
        message?.messageStubParameters?.length &&
        message.messageStubParameters[0].includes("absent")
      ) {
        const msg = {
          companyId: companyId,
          whatsappId: wbot.id,
          message: message
        };
        logger.warn("MENSAGEM PERDIDA", JSON.stringify(msg));
      }
      const messageExists = await Message.count({
        where: { wid: message.key.id!, companyId }
      });

      if (!messageExists) {
        let isCampaign = false;
        let body = await getBodyMessage(message);
        const fromMe = message?.key?.fromMe;
        if (fromMe) {
          isCampaign = /\u200c/.test(body);
        } else {
          if (/\u200c/.test(body)) body = body.replace(/\u200c/, "");
          logger.debug(
            "Validação de mensagem de campanha enviada por terceiros: " + body
          );
        }

        if (!isCampaign) {
          if (REDIS_URI_MSG_CONN !== "") {
            //} && (!message.key.fromMe || (message.key.fromMe && !message.key.id.startsWith('BAE')))) {
            try {
              await BullQueues.add(
                `${process.env.DB_NAME}-handleMessage`,
                { message, wbot: wbot.id, companyId },
                {
                  priority: 1,
                  jobId: `${wbot.id}-handleMessage-${message.key.id}`
                }
              );
            } catch (e) {
              Sentry.captureException(e);
            }
          } else {
            await handleMessage(message, wbot, companyId);
          }
        }

        await verifyRecentCampaign(message, companyId);
        await verifyCampaignMessageAndCloseTicket(message, companyId, wbot);
      }

      if (message.key.remoteJid?.endsWith("@g.us")) {
        if (REDIS_URI_MSG_CONN !== "") {
          BullQueues.add(
            `${process.env.DB_NAME}-handleMessageAck`,
            { msg: message, chat: 2 },
            {
              priority: 1,
              jobId: `${wbot.id}-handleMessageAck-${message.key.id}`
            }
          );
        } else {
          handleMsgAck(message, 2);
        }
      }
    });

    // messages.forEach(async (message: proto.IWebMessageInfo) => {
    //   const messageExists = await Message.count({
    //     where: { id: message.key.id!, companyId }
    //   });

    //   if (!messageExists) {
    //     await handleMessage(message, wbot, companyId);
    //     await verifyRecentCampaign(message, companyId);
    //     await verifyCampaignMessageAndCloseTicket(message, companyId);
    //   }
    // });
  });

  wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
    if (messageUpdate.length === 0) return;
    messageUpdate.forEach(async (message: WAMessageUpdate) => {
      // DESABILITADO: Envio automático de ACKs (read receipts)
      // O WhatsApp pode banir contas que enviam ACKs automaticamente em massa
      // Referência: Baileys v7.x removeu isso por esse motivo
      // (wbot as WASocket)!.readMessages([message.key]);

      const msgUp = { ...messageUpdate };

      if (
        msgUp["0"]?.update.messageStubType === 1 &&
        msgUp["0"]?.key.remoteJid !== "status@broadcast"
      ) {
        MarkDeleteWhatsAppMessage(
          msgUp["0"]?.key.remoteJid,
          null,
          msgUp["0"]?.key.id,
          companyId
        );
      }

      // ACK status: 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ_ACK
      // Usar o status recebido diretamente para sincronização correta
      const ack = message.update.status;

      if (REDIS_URI_MSG_CONN !== "") {
        BullQueues.add(
          `${process.env.DB_NAME}-handleMessageAck`,
          { msg: message, chat: ack },
          {
            priority: 1,
            jobId: `${wbot.id}-handleMessageAck-${message.key.id}`
          }
        );
      } else {
        handleMsgAck(message, ack);
      }
    });
  });

  // Phase 3: Habilitar message-receipt.update para atualização de read receipts
  wbot.ev.on('message-receipt.update', (events: any) => {
    events.forEach(async (msg: any) => {
      try {
        // receiptTimestamp = entregue, readTimestamp = lido
        const ack = msg?.receipt?.readTimestamp ? 4 : msg?.receipt?.receiptTimestamp ? 3 : 0;
        if (!ack) return;
        logger.info(`[message-receipt.update] ACK=${ack} para msgId=${msg?.key?.id}`);
        await handleMsgAck(msg, ack);
      } catch (err) {
        logger.error(`[message-receipt.update] Erro: ${err}`);
      }
    });
  });

  // Indicador "digitando..." / "gravando áudio" para o frontend
  wbot.ev.on("presence.update", (presenceData: any) => {
    try {
      const io = getIO();
      const jid = presenceData?.id;
      if (!jid) return;

      // presenceData.presences é um mapa { jid: { lastKnownPresence, lastSeen } }
      const presences = presenceData?.presences;
      if (!presences) return;

      for (const [participantJid, info] of Object.entries(presences)) {
        const presence = (info as any)?.lastKnownPresence;
        if (!presence) continue;

        // Emitir para o frontend: composing, recording, paused, available, unavailable
        io.of(`/workspace-${companyId}`).emit(`company-${companyId}-presence`, {
          chatJid: jid,
          participantJid,
          presence, // "composing" | "recording" | "paused" | "available" | "unavailable"
        });
      }
    } catch (err: any) {
      // Não falhar por erro no presence
      logger.debug(`[wbot] presence.update erro: ${err?.message}`);
    }
  });

  wbot.ev.on("contacts.update", (contacts: any) => {
    contacts.forEach(async (contact: any) => {
      console.log(`[contacts.update] contato: ${contact.id} | notify:`, contact.notify, '| objeto completo:', contact);
      if (!contact?.id) return;

      // Tratamento especial para LIDs: atualizar contatos PENDING_ existentes OU criar novo contato LID
      if (contact.id.includes("@lid")) {
        const contactName = contact.notify || contact.verifiedName || "";

        try {
          // Primeiro: tentar atualizar contato PENDING_ existente
          const pendingContact = await Contact.findOne({
            where: {
              companyId,
              [Op.or]: [
                { lidJid: contact.id },
                { remoteJid: contact.id },
                { number: `PENDING_${contact.id}` }
              ]
            }
          });

          if (pendingContact) {
            if (contactName) {
              const currentName = (pendingContact.name || "").trim();
              const isPendingName = currentName === "" || currentName.startsWith("Contato ") || currentName === pendingContact.number;
              if (isPendingName) {
                await pendingContact.update({ name: contactName });
                logger.info(`[contacts.update] LID ${contact.id} → nome atualizado para "${contactName}" (contactId=${pendingContact.id})`);
              }
            }
          } else {
            // NOVO: Criar contato LID se não existir
            // Extrair número do LID para uso temporário
            const lidNumber = contact.id.replace(/\D/g, "");
            const tempName = contactName || `Contato ${lidNumber.slice(-8)}`;

            // Criar novo contato com LID
            const newContact = await Contact.create({
              name: tempName,
              number: `PENDING_${contact.id}`,  // Marcador para identificar como pendente de resolução
              canonicalNumber: null,
              companyId,
              whatsappId: wbot.id,
              isGroup: false,
              remoteJid: contact.id,  // O LID completo
              lidJid: contact.id,
              profilePicUrl: "",
              pushName: contact.notify || null,
              businessName: contact.verifiedName || null
            });

            logger.info(`[contacts.update] Novo contato LID criado: ${contact.id} → contactId=${newContact.id}, nome="${tempName}"`);
          }
        } catch (err: any) {
          logger.warn({ err: err?.message }, `[contacts.update] Erro ao processar contato LID ${contact.id}`);
        }

        // Não processar LIDs como contatos normais (número extraído seria inválido)
        return;
      }

      // Processar contatos normais (não-LID) - independente de ter avatar ou não
      // A condição imgUrl !== undefined foi removida para garantir atualização de nome sempre
      const newUrl = contact.imgUrl
        ? await wbot!.profilePictureUrl(contact.id!).catch(() => null)
        : null;
      const numero = contact.id.replace(/\D/g, "");

      // PRIORIDADE 1: Nome da agenda do WhatsApp (notify)
      let finalName = contact.notify;

      // Se notify estiver vazio (comum em contatos LID), busca outras fontes
      if (!finalName || finalName.trim() === "") {
        console.log(`[contacts.update] notify vazio para ${contact.id}, buscando outras fontes`);

        // PRIORIDADE 2: Nome já cadastrado no CRM (se não for apenas o número)
        const existingContact = await Contact.findOne({ where: { remoteJid: contact.id, companyId } });
        if (existingContact?.name && existingContact.name.replace(/\D/g, "") !== numero) {
          finalName = existingContact.name;
          console.log(`[contacts.update] Usando nome do CRM: ${finalName}`);
        } else {
          // PRIORIDADE 3: Nome do perfil do usuário (businessProfile)
          try {
            console.log(`[contacts.update] Tentando buscar perfil do usuário: ${contact.id}`);
            const businessProfile = await wbot.getBusinessProfile(contact.id).catch(() => null);

            if (businessProfile?.email) {
              finalName = businessProfile.email;
              console.log(`[contacts.update] Email do perfil encontrado: ${finalName}`);
            } else if (businessProfile?.description) {
              // LIMITAR description para evitar mensagens de marketing completas
              const desc = businessProfile.description.trim();
              if (desc.length <= 100 && !desc.includes('\n')) {
                finalName = desc;
                console.log(`[contacts.update] Description do perfil encontrada (curta): ${finalName}`);
              } else {
                // Description muito longa = mensagem de marketing, ignorar
                finalName = numero;
                console.log(`[contacts.update] Description muito longa (${desc.length} chars), usando número: ${numero}`);
              }
            } else {
              finalName = numero;
              console.log(`[contacts.update] Nenhum nome encontrado, usando número: ${numero}`);
            }
          } catch (err) {
            finalName = numero;
            console.log(`[contacts.update] Erro ao buscar perfil, usando número:`, err);
          }

        }
      } else {
        console.log(`[contacts.update] Usando notify da agenda: ${finalName}`);
      }

      const contactData = {
        name: finalName,
        number: numero,
        isGroup: contact.id.includes("@g.us") ? true : false,
        companyId: companyId,
        remoteJid: contact.id,
        profilePicUrl: newUrl,
        whatsappId: wbot.id,
        wbot: wbot
      };

      await CreateOrUpdateContactService(contactData);
    });
  });
  wbot.ev.on("groups.update", (groupUpdate: GroupMetadata[]) => {
    if (!groupUpdate[0]?.id) return;
    if (groupUpdate.length === 0) return;
    groupUpdate.forEach(async (group: GroupMetadata) => {
      const number = group.id.replace(/\D/g, "");
      const nameGroup = group.subject && group.subject.trim() !== "" ? group.subject : "Grupo desconhecido";

      let profilePicUrl: string = "";
      try {
        profilePicUrl = await wbot.profilePictureUrl(group.id, "image");
      } catch (e) {
        Sentry.captureException(e);
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }
      const contactData = {
        name: nameGroup,
        number: number,
        isGroup: true,
        companyId: companyId,
        remoteJid: group.id,
        profilePicUrl,
        whatsappId: wbot.id,
        wbot: wbot
      };

      const contact = await CreateOrUpdateContactService(contactData);
    });
  });
};

export {
  wbotMessageListener,
  handleMessage,
  isValidMsg,
  getTypeMessage,
  handleMsgAck
};
