import * as Sentry from "@sentry/node";
import BullQueue from "bull";
import { MessageData, SendMessage } from "./helpers/SendMessage";
import Whatsapp from "./models/Whatsapp";
import logger from "./utils/logger";
import moment from "moment";
import Schedule from "./models/Schedule";
import { Op, QueryTypes, Sequelize } from "sequelize";
import GetDefaultWhatsApp from "./helpers/GetDefaultWhatsApp";
import Campaign from "./models/Campaign";
import Queues from "./models/Queue";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";
import { isEmpty, isNil, isArray } from "lodash";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";
import GetWhatsappWbot from "./helpers/GetWhatsappWbot";
import sequelize from "./database";
import { getMessageOptions } from "./services/WbotServices/SendWhatsAppMedia";
import { getIO } from "./libs/socket";
import path from "path";
import User from "./models/User";
import Company from "./models/Company";
import Contact from "./models/Contact";
import Queue from "./models/Queue";
import { ClosedAllOpenTickets } from "./services/WbotServices/wbotClosedTickets";
import Ticket from "./models/Ticket";
import ShowContactService from "./services/ContactServices/ShowContactService";
import UserQueue from "./models/UserQueue";
import ShowTicketService from "./services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "./services/WbotServices/SendWhatsAppMessage";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import { addSeconds, differenceInSeconds } from "date-fns";
import { GetWhatsapp } from "./helpers/GetWhatsapp";
import { safeNormalizePhoneNumber } from "./utils/phone";
const CronJob = require('cron').CronJob;
import CompaniesSettings from "./models/CompaniesSettings";
import { verifyMediaMessage, verifyMessage } from "./services/WbotServices/wbotMessageListener";
import FindOrCreateTicketService from "./services/TicketServices/FindOrCreateTicketService";
import CreateLogTicketService from "./services/TicketServices/CreateLogTicketService";
import formatBody from "./helpers/Mustache";
import TicketTag from "./models/TicketTag";
import Tag from "./models/Tag";
import { delay } from "@whiskeysockets/baileys";
import Plan from "./models/Plan";
import GetWhatsAppAdapter from "./helpers/GetWhatsAppAdapter";
import SendTemplateToContact from "./services/MetaServices/SendTemplateToContact";
import GetTemplateDefinition from "./services/MetaServices/GetTemplateDefinition";
import MapTemplateParameters from "./services/MetaServices/MapTemplateParameters";
import CreateMessageService from "./services/MessageServices/CreateMessageService";

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;

// Controle de backoff por conexão (whatsappId) em memória
type BackoffState = { count: number; lastErrorAt: number; pausedUntil?: number };
const backoffMap: Map<number, BackoffState> = new Map();
// Controle de pacing por conexão (whatsappId) em memória
type PacingState = { lastSentAt?: number; blockedUntil?: number; sentSinceLonger: number };
const pacingMap: Map<number, PacingState> = new Map();

interface ProcessCampaignData {
  id: number;
  delay: number;
}

interface CampaignSettings {
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  variables: any[];
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

interface CapBackoffSettings {
  capHourly: number; // mensagens/hora por conexão
  capDaily: number;  // mensagens/dia por conexão
  backoffErrorThreshold: number; // nº de erros consecutivos para acionar pausa
  backoffPauseMinutes: number;   // minutos de pausa quando atingir o threshold
}

interface IntervalSettings {
  messageIntervalMs: number;      // intervalo mínimo entre envios por conexão
  longerIntervalAfter: number;    // após X mensagens, aplicar pausa maior
  greaterIntervalMs: number;      // duração da pausa maior
}

/**
 * Determina o usuário correto para atribuir o ticket baseado nas tags do contato
 * Lógica de tags hierárquicas:
 * - # (1x) = Tag Pessoal (obrigatória) - Ex: #NOME-USUARIO
 * - ## (2x) = Grupo (complementar) - Ex: ##CLIENTES
 * - ### (3x) = Região (complementar) - Ex: ###REGIAO-NORTE
 * - Sem # = Transacional (não afeta permissões)
 * 
 * Se o contato tem a tag pessoal de um usuário, atribui a ele.
 * Se não tem nenhuma tag pessoal, retorna null (ticket fica sem usuário específico).
 * 
 * ADMIN: Usuários com profile="admin" veem todos os tickets independente das tags.
 * Se houver um admin na lista e nenhum match de tag, o ticket vai para o admin.
 */
async function getUserIdByContactTags(
  contactId: number,
  userIds: number[],
  companyId: number
): Promise<number | null> {
  if (!userIds || userIds.length === 0) {
    return null;
  }

  // Se só tem um usuário, retorna ele diretamente
  if (userIds.length === 1) {
    return userIds[0];
  }

  try {
    // Buscar usuários com profile e allowedContactTags (lista de IDs de tags de permissão)
    const users = await User.findAll({
      where: {
        id: { [Op.in]: userIds },
        companyId
      },
      attributes: ["id", "name", "profile", "allowedContactTags"]
    });

    // Separar admins dos usuários normais
    const adminUsers = users.filter((u: any) => u.profile === "admin");
    const normalUsers = users.filter((u: any) => u.profile !== "admin");

    // Pré-carrega todas as tags de permissão referenciadas em allowedContactTags
    const allAllowedTagIds = new Set<number>();
    for (const u of users as any[]) {
      const allowed = Array.isArray(u.allowedContactTags)
        ? (u.allowedContactTags as number[])
        : [];
      for (const tagId of allowed) {
        if (Number.isInteger(tagId)) {
          allAllowedTagIds.add(tagId);
        }
      }
    }

    const userPermissionTags: any[] = allAllowedTagIds.size
      ? await Tag.findAll({
        where: {
          companyId,
          id: { [Op.in]: Array.from(allAllowedTagIds) },
          name: { [Op.like]: '#%' } // Apenas tags que começam com #
        },
        attributes: ["id", "name"]
      })
      : [];

    const tagById = new Map<number, any>();
    for (const t of userPermissionTags) {
      tagById.set(t.id, t);
    }

    // Buscar tags do contato (apenas tags pessoais que começam com #)
    const contactTags = await Tag.findAll({
      include: [{
        model: Contact,
        as: "contacts",
        where: { id: contactId },
        attributes: []
      }],
      where: {
        companyId,
        name: { [Op.like]: '#%' }  // Apenas tags que começam com #
      },
      attributes: ["id", "name"]
    });

    // Se contato não tem tags pessoais
    if (contactTags.length === 0) {
      // Se tem admin na lista, atribui ao primeiro admin
      if (adminUsers.length > 0) {
        logger.info(`[getUserIdByContactTags] Contato ${contactId} sem tags, atribuindo ao admin ${adminUsers[0].name} (${adminUsers[0].id})`);
        return adminUsers[0].id;
      }
      // Senão, ticket fica sem usuário específico (visível a todos)
      logger.info(`[getUserIdByContactTags] Contato ${contactId} sem tags pessoais, ticket ficará sem usuário específico`);
      return null;
    }

    // Primeiro, tentar match com usuários normais (não-admin)
    for (const user of normalUsers) {
      const allowed = Array.isArray((user as any).allowedContactTags)
        ? ((user as any).allowedContactTags as number[])
        : [];

      // Tags carregadas para este usuário a partir de allowedContactTags
      const userTags = allowed
        .map(id => tagById.get(id))
        .filter((t: any) => !!t);

      // Buscar tags pessoais do usuário (começam com # mas não com ##)
      const userPersonalTags = userTags.filter((t: any) =>
        t.name.startsWith('#') && !t.name.startsWith('##')
      );

      // Verificar se alguma tag pessoal do contato corresponde à tag pessoal do usuário
      for (const contactTag of contactTags) {
        // Tag pessoal do contato (começa com # mas não com ##)
        if (contactTag.name.startsWith('#') && !contactTag.name.startsWith('##')) {
          for (const userTag of userPersonalTags) {
            if (contactTag.name.toLowerCase() === userTag.name.toLowerCase()) {
              logger.info(`[getUserIdByContactTags] Contato ${contactId} tem tag "${contactTag.name}" do usuário ${user.name} (${user.id})`);
              return user.id;
            }
          }
        }
      }
    }

    // Se não encontrou match com usuários normais, verificar se tem admin
    if (adminUsers.length > 0) {
      // Admin vê todos - atribui ao primeiro admin da lista
      logger.info(`[getUserIdByContactTags] Contato ${contactId} sem match de tag, atribuindo ao admin ${adminUsers[0].name} (${adminUsers[0].id})`);
      return adminUsers[0].id;
    }

    // Nenhum usuário corresponde às tags do contato e não tem admin
    logger.info(`[getUserIdByContactTags] Contato ${contactId} tem tags mas nenhuma corresponde aos usuários selecionados`);
    return null;

  } catch (error: any) {
    logger.error(`[getUserIdByContactTags] Erro ao buscar tags: ${error.message}`);
    return userIds[0]; // Fallback: primeiro usuário da lista
  }
}

export const userMonitor = new BullQueue("UserMonitor", connection);
export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue("SendSacheduledMessages", connection);
export const campaignQueue = new BullQueue("CampaignQueue", connection);
export const queueMonitor = new BullQueue("QueueMonitor", connection);
export const validateWhatsappContactsQueue = new BullQueue("ValidateWhatsappContacts", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

let isProcessing = false;

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp === null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifySchedules(job) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.gte]: moment().format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [{ model: Contact, as: "contact" }, { model: User, as: "user", attributes: ["name"] }],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          status: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    let whatsapp

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
    }

    if (!whatsapp)
      whatsapp = await GetDefaultWhatsApp(whatsapp.id, schedule.companyId);


    // const settings = await CompaniesSettings.findOne({
    //   where: {
    //     companyId: schedule.companyId
    //   }
    // })

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve("public", `company${schedule.companyId}`, schedule.mediaPath);
    }

    let bodyMessage;

    // @ts-ignore: Unreachable code error
    if (schedule.assinar && !isNil(schedule.userId)) {
      bodyMessage = `*${schedule?.user?.name}:*\n${schedule.body.trim()}`
    } else {
      bodyMessage = schedule.body.trim();
    }

    if (schedule.openTicket === "enabled") {
      let ticket = await Ticket.findOne({
        where: {
          contactId: schedule.contact.id,
          companyId: schedule.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      })

      if (!ticket)
        ticket = await Ticket.create({
          companyId: schedule.companyId,
          contactId: schedule.contactId,
          whatsappId: whatsapp.id,
          queueId: schedule.queueId,
          userId: schedule.ticketUserId,
          status: schedule.statusTicket
        })

      ticket = await ShowTicketService(ticket.id, schedule.companyId);

      const sentMessage = await SendMessage(whatsapp, {
        number: schedule.contact.number,
        body: `\u200e ${formatBody(bodyMessage, ticket)}`,
        mediaPath: filePath,
        companyId: schedule.companyId
      },
        schedule.contact.isGroup
      );

      if (schedule.mediaPath) {
        await verifyMediaMessage(sentMessage, ticket, ticket.contact, null, true, false, whatsapp);
      } else {
        await verifyMessage(sentMessage, ticket, ticket.contact, null, true, false);
      }
    } else {
      await SendMessage(whatsapp, {
        number: schedule.contact.number,
        body: `\u200e ${formatBody(bodyMessage)}`,
        mediaPath: filePath,
        companyId: schedule.companyId
      },
        schedule.contact.isGroup);
    }

    if (schedule.valorIntervalo > 0 && (isNil(schedule.contadorEnvio) || schedule.contadorEnvio < schedule.enviarQuantasVezes)) {
      let unidadeIntervalo;
      switch (schedule.intervalo) {
        case 1:
          unidadeIntervalo = 'days';
          break;
        case 2:
          unidadeIntervalo = 'weeks';
          break;
        case 3:
          unidadeIntervalo = 'months';
          break;
        case 4:
          unidadeIntervalo = 'minuts';
          break;
        default:
          throw new Error('Intervalo inválido');
      }

      function isDiaUtil(date) {
        const dayOfWeek = date.day();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 1 é segunda-feira, 5 é sexta-feira
      }

      function proximoDiaUtil(date) {
        let proximoDia = date.clone();
        do {
          proximoDia.add(1, 'day');
        } while (!isDiaUtil(proximoDia));
        return proximoDia;
      }

      // Função para encontrar o dia útil anterior
      function diaUtilAnterior(date) {
        let diaAnterior = date.clone();
        do {
          diaAnterior.subtract(1, 'day');
        } while (!isDiaUtil(diaAnterior));
        return diaAnterior;
      }

      const dataExistente = new Date(schedule.sendAt);
      const hora = dataExistente.getHours();
      const fusoHorario = dataExistente.getTimezoneOffset();

      // Realizar a soma da data com base no intervalo e valor do intervalo
      let novaData = new Date(dataExistente); // Clone da data existente para não modificar a original

      console.log(unidadeIntervalo)
      if (unidadeIntervalo !== "minuts") {
        novaData.setDate(novaData.getDate() + schedule.valorIntervalo * (unidadeIntervalo === 'days' ? 1 : unidadeIntervalo === 'weeks' ? 7 : 30));
      } else {
        novaData.setMinutes(novaData.getMinutes() + Number(schedule.valorIntervalo));
        console.log(novaData)
      }

      if (schedule.tipoDias === 5 && !isDiaUtil(novaData)) {
        novaData = diaUtilAnterior(novaData);
      } else if (schedule.tipoDias === 6 && !isDiaUtil(novaData)) {
        novaData = proximoDiaUtil(novaData);
      }

      novaData.setHours(hora);
      novaData.setMinutes(novaData.getMinutes() - fusoHorario);

      await scheduleRecord?.update({
        status: "PENDENTE",
        contadorEnvio: schedule.contadorEnvio + 1,
        sendAt: new Date(novaData.toISOString().slice(0, 19).replace('T', ' ')) // Mantendo o formato de hora
      })
    } else {
      await scheduleRecord?.update({
        sentAt: new Date(moment().format("YYYY-MM-DD HH:mm")),
        status: "ENVIADA"
      });
    }
    logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    logger.error("SendScheduledMessage -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifyCampaigns(job) {
  if (isProcessing) {
    // logger.warn('A campaign verification process is already running.');
    return;
  }

  isProcessing = true;
  try {
    await new Promise(r => setTimeout(r, 1500));

    const campaigns: { id: number; scheduledAt: string }[] =
      await sequelize.query(
        `SELECT id, "scheduledAt" FROM "Campaigns" c
        WHERE "scheduledAt" BETWEEN NOW() AND NOW() + INTERVAL '3 hour' AND status = 'PROGRAMADA'`,
        { type: QueryTypes.SELECT }
      );

    if (campaigns.length > 0) {
      logger.info(`Campanhas encontradas: ${campaigns.length}`);

      const promises = campaigns.map(async (campaign) => {
        try {
          await sequelize.query(
            `UPDATE "Campaigns" SET status = 'EM_ANDAMENTO' WHERE id = ${campaign.id}`
          );

          const now = moment();
          const scheduledAt = moment(campaign.scheduledAt);
          const delay = scheduledAt.diff(now, "milliseconds");
          logger.info(
            `Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delay}`
          );

          return campaignQueue.add(
            "ProcessCampaign",
            { id: campaign.id, delay },
            { priority: 3, removeOnComplete: { age: 60 * 60, count: 10 }, removeOnFail: { age: 60 * 60, count: 10 } }
          );

        } catch (err) {
          Sentry.captureException(err);
        }
      });

      await Promise.all(promises);

      logger.info('Todas as campanhas foram processadas e adicionadas à fila.');
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error processing campaigns: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}


async function getCampaign(id) {
  // Primeiro busca a campanha com o whatsapp para verificar o tipo de canal
  const campaign = await Campaign.findOne({
    where: { id },
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"]
        // IMPORTANTE: NÃO incluir ContactListItem aqui!
        // Estava carregando 686+ contatos repetidamente causando lentidão extrema
        // Os contatos são carregados UMA VEZ em handleProcessCampaign (linha 1287)
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "channelType"]
      }
    ]
  });

  // Log apenas para debug de metaTemplateVariables
  if (campaign) {
    console.log(`[getCampaign] Campaign ${id} metaTemplateVariables:`, JSON.stringify((campaign as any).metaTemplateVariables));
  } else {
    logger.error(`[getCampaign] Campaign ${id} não encontrada!`);
  }

  return campaign;
}

async function getContact(id) {
  return await ContactListItem.findByPk(id, {
    attributes: ["id", "name", "number", "email", "isGroup"]
  });
}

async function getSettings(campaign): Promise<CampaignSettings> {
  try {
    if (!campaign) {
      logger.error("[getSettings] Campanha nula recebida, retornando defaults.");
      return {
        messageInterval: 20,
        longerIntervalAfter: 20,
        greaterInterval: 60,
        variables: []
      };
    }

    const settings = await CampaignSetting.findAll({
      where: { companyId: campaign.companyId },
      attributes: ["key", "value"]
    });

    let messageInterval: number = 20;
    let longerIntervalAfter: number = 20;
    let greaterInterval: number = 60;
    let variables: any[] = [];

    settings.forEach(setting => {
      if (setting.key === "messageInterval") {
        messageInterval = JSON.parse(setting.value);
      }
      if (setting.key === "longerIntervalAfter") {
        longerIntervalAfter = JSON.parse(setting.value);
      }
      if (setting.key === "greaterInterval") {
        greaterInterval = JSON.parse(setting.value);
      }
      if (setting.key === "variables") {
        variables = JSON.parse(setting.value);
      }
    });

    return {
      messageInterval,
      longerIntervalAfter,
      greaterInterval,
      variables
    };

  } catch (error) {
    console.log(error);
    throw error; // rejeita a Promise com o erro original
  }
}

export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

async function sleep(seconds) {
  logger.info(
    `Sleep de ${seconds} segundos iniciado: ${moment().format("HH:mm:ss")}`
  );
  return new Promise(resolve => {
    setTimeout(() => {
      logger.info(
        `Sleep de ${seconds} segundos finalizado: ${moment().format(
          "HH:mm:ss"
        )}`
      );
      resolve(true);
    }, parseToMilliseconds(seconds));
  });
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(msg: string, variables: any[], contact: any) {
  let finalMessage = msg || "";

  const name: string = contact?.name || "";
  const firstName: string = (name || "").trim().split(/\s+/)[0] || name;
  const email: string = contact?.email || "";
  const number: string = contact?.number || "";

  const now = moment();
  const dateStr = now.format("DD/MM/YYYY");
  const timeStr = now.format("HH:mm:ss");
  const dateTimeStr = now.format("DD/MM/YYYY HH:mm:ss");

  const hour = now.hour();
  const periodo = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
  const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const replacements: Record<string, string> = {
    "nome": name,
    "primeiro-nome": firstName,
    "email": email,
    "numero": number,
    "data": dateStr,
    "hora": timeStr,
    "data-hora": dateTimeStr,
    "periodo-dia": periodo,
    "saudacao": saudacao,
  };

  Object.keys(replacements).forEach((key) => {
    const value = replacements[key] ?? "";
    const rx = new RegExp(`\\{${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\}`, "g");
    finalMessage = finalMessage.replace(rx, value);
  });

  try {
    if (Array.isArray(variables) && variables.length > 0 && variables[0]?.value !== '[]') {
      variables.forEach((variable: any) => {
        if (!variable?.key) return;
        const raw = String(variable.key);
        const rx = new RegExp(`\\{${raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\}`, "g");
        finalMessage = finalMessage.replace(rx, String(variable.value ?? ""));
      });
    }
  } catch { }

  // Aliases pt-BR -> chaves reais do modelo de contato
  try {
    const aliasMap: Record<string, string> = {
      "cidade": "city",
      "situacao": "situation",
      "fantasia": "fantasyName",
      "data-fundacao": "foundationDate",
      "limite-credito": "creditLimit",
      "segmento": "segment",
      "cnpj-cpf": "cpfCnpj",
      "codigo-representante": "representativeCode",
    };
    if (contact && typeof contact === 'object') {
      Object.entries(aliasMap).forEach(([alias, key]) => {
        if (key in contact && contact[key] != null) {
          const value = String(contact[key]);
          const rx = new RegExp(`\\{${alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\}`, "g");
          finalMessage = finalMessage.replace(rx, value);
        }
      });
    }
  } catch { }

  try {
    const toKebab = (s: string) => s
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[ _]+/g, "-")
      .toLowerCase();
    if (contact && typeof contact === 'object') {
      Object.keys(contact).forEach((key) => {
        const val = (contact as any)[key];
        if (val === null || val === undefined) return;
        if (["string", "number", "boolean"].includes(typeof val)) {
          const value = String(val);
          const rxKey = new RegExp(`\\{${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\}`, "g");
          finalMessage = finalMessage.replace(rxKey, value);
          const kebab = toKebab(key);
          if (kebab !== key) {
            const rxKebab = new RegExp(`\\{${kebab.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\}`, "g");
            finalMessage = finalMessage.replace(rxKebab, value);
          }
        }
      });
    }
  } catch { }

  return finalMessage;
}

const checkerWeek = async () => {
  const sab = moment().day() === 6;
  const dom = moment().day() === 0;

  const sabado = await CampaignSetting.findOne({
    where: { key: "sabado" }
  });

  const domingo = await CampaignSetting.findOne({
    where: { key: "domingo" }
  });

  if (sabado?.value === "false" && sab) {
    messageQueue.pause();
    return true;
  }

  if (domingo?.value === "false" && dom) {
    messageQueue.pause();
    return true;
  }

  messageQueue.resume();
  return false;
};

const checkTime = async () => {
  const startHour = await CampaignSetting.findOne({
    where: {
      key: "startHour"
    }
  });

  const endHour = await CampaignSetting.findOne({
    where: {
      key: "endHour"
    }
  });

  const hour = startHour.value as unknown as number;
  const endHours = endHour.value as unknown as number;

  const timeNow = moment().format("HH:mm") as unknown as number;

  if (timeNow <= endHours && timeNow >= hour) {
    messageQueue.resume();

    return true;
  }


  logger.info(
    `Envio inicia as ${hour} e termina as ${endHours}, hora atual ${timeNow} não está dentro do horário`
  );
  messageQueue.clean(0, "delayed");
  messageQueue.clean(0, "wait");
  messageQueue.clean(0, "active");
  messageQueue.clean(0, "completed");
  messageQueue.clean(0, "failed");
  messageQueue.pause();

  return false;
};

// const checkerLimitToday = async (whatsappId: number) => {
//   try {

//     const setting = await SettingMessage.findOne({
//       where: { whatsappId: whatsappId }
//     });


//     const lastUpdate = moment(setting.dateStart);

//     const now = moment();

//     const passou = now.isAfter(lastUpdate, "day");



//     if (setting.sendToday <= setting.limit) {
//       await setting.update({
//         dateStart: moment().format()
//       });

//       return true;
//     }

//     const zerar = true
//     if(passou) {
//       await setting.update({
//         sendToday: 0,
//         dateStart: moment().format()
//       });

//       setting.reload();
//     }


//     setting.reload();

//     logger.info(`Enviada hoje ${setting.sendToday} limite ${setting.limit}`);
//     // sendMassMessage.clean(0, "delayed");
//     // sendMassMessage.clean(0, "wait");
//     // sendMassMessage.clean(0, "active");
//     // sendMassMessage.clean(0, "completed");
//     // sendMassMessage.clean(0, "failed");
//     // sendMassMessage.pause();
//     return false;
//   } catch (error) {
//     logger.error("conexão não tem configuração de envio.");
//   }
// };

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}

async function getCapBackoffSettings(companyId: number, isOfficialApi: boolean = false): Promise<CapBackoffSettings> {
  try {
    const settings = await CampaignSetting.findAll({
      where: { companyId },
      attributes: ["key", "value"]
    });

    // Defaults para Baileys (conservadores)
    let capHourly = Number(process.env.CAP_HOURLY) || 300;
    let capDaily = Number(process.env.CAP_DAILY) || 2000;
    let backoffErrorThreshold = Number(process.env.BACKOFF_ERROR_THRESHOLD) || 5;
    let backoffPauseMinutes = Number(process.env.BACKOFF_PAUSE_MINUTES) || 10;

    // Defaults para API Oficial (muito mais altos - Meta permite milhares por dia)
    let officialCapHourly = Number(process.env.OFFICIAL_API_CAP_HOURLY) || 1000;
    let officialCapDaily = Number(process.env.OFFICIAL_API_CAP_DAILY) || 10000;

    settings.forEach(s => {
      try {
        const v = s.value ? JSON.parse(s.value) : null;
        if (v == null) return;

        // Configurações Baileys
        if (s.key === "capHourly") capHourly = Number(v);
        if (s.key === "capDaily") capDaily = Number(v);
        if (s.key === "backoffErrorThreshold") backoffErrorThreshold = Number(v);
        if (s.key === "backoffPauseMinutes") backoffPauseMinutes = Number(v);

        // Configurações API Oficial
        if (s.key === "officialApiCapHourly") officialCapHourly = Number(v);
        if (s.key === "officialApiCapDaily") officialCapDaily = Number(v);
      } catch { }
    });

    // Retornar caps baseado no tipo de conexão
    if (isOfficialApi) {
      return {
        capHourly: officialCapHourly,
        capDaily: officialCapDaily,
        backoffErrorThreshold,
        backoffPauseMinutes
      };
    }

    return { capHourly, capDaily, backoffErrorThreshold, backoffPauseMinutes };
  } catch (e) {
    // Retorna defaults em caso de erro
    if (isOfficialApi) {
      return {
        capHourly: Number(process.env.OFFICIAL_API_CAP_HOURLY) || 1000,
        capDaily: Number(process.env.OFFICIAL_API_CAP_DAILY) || 10000,
        backoffErrorThreshold: Number(process.env.BACKOFF_ERROR_THRESHOLD) || 5,
        backoffPauseMinutes: Number(process.env.BACKOFF_PAUSE_MINUTES) || 10
      };
    }
    return {
      capHourly: Number(process.env.CAP_HOURLY) || 300,
      capDaily: Number(process.env.CAP_DAILY) || 2000,
      backoffErrorThreshold: Number(process.env.BACKOFF_ERROR_THRESHOLD) || 5,
      backoffPauseMinutes: Number(process.env.BACKOFF_PAUSE_MINUTES) || 10
    };
  }
}

async function countDeliveredSince(whatsappId: number, sinceISO: string): Promise<number> {
  const sql = `
    SELECT COUNT(cs.id) AS cnt
    FROM "CampaignShipping" cs
    INNER JOIN "Campaigns" c ON c.id = cs."campaignId"
    WHERE c."whatsappId" = :whatsappId
      AND cs."deliveredAt" IS NOT NULL
      AND cs."jobId" IS NOT NULL
      AND cs."deliveredAt" >= :since
  `;
  const result: any[] = await sequelize.query(sql, {
    type: QueryTypes.SELECT,
    replacements: { whatsappId, since: sinceISO }
  });
  return Number(result[0]?.cnt || 0);
}

async function getCapDeferDelayMs(whatsappId: number, caps: CapBackoffSettings): Promise<number> {
  const now = moment();
  // janela horária
  const hourStart = now.clone().startOf("hour");
  const hourlyCount = await countDeliveredSince(whatsappId, hourStart.toISOString());
  let deferHourMs = 0;
  if (hourlyCount >= caps.capHourly) {
    const nextHour = hourStart.clone().add(1, "hour");
    deferHourMs = nextHour.diff(now, "milliseconds") + randomValue(250, 1250);
  }

  // janela diária
  const dayStart = now.clone().startOf("day");
  const dailyCount = await countDeliveredSince(whatsappId, dayStart.toISOString());
  let deferDayMs = 0;
  if (dailyCount >= caps.capDaily) {
    const nextDay = dayStart.clone().add(1, "day");
    deferDayMs = nextDay.diff(now, "milliseconds") + randomValue(1000, 5000);
  }

  return Math.max(deferHourMs, deferDayMs);
}

function getBackoffDeferDelayMs(whatsappId: number): number {
  const state = backoffMap.get(whatsappId);
  if (!state || !state.pausedUntil) return 0;
  const now = Date.now();
  return state.pausedUntil > now ? (state.pausedUntil - now) + randomValue(250, 1000) : 0;
}

// ==== Intervalos (messageInterval, longerIntervalAfter, greaterInterval) ====
async function getIntervalSettings(companyId: number, isOfficialApi: boolean = false): Promise<IntervalSettings> {
  try {
    const settings = await CampaignSetting.findAll({
      where: { companyId },
      attributes: ["key", "value"]
    });

    // Defaults conservadores para Baileys (lê do .env)
    let messageInterval = Number(process.env.MESSAGE_INTERVAL_SEC) || 60;       // segundos
    let longerIntervalAfter = Number(process.env.LONGER_INTERVAL_AFTER) || 10;   // mensagens
    let greaterInterval = Number(process.env.GREATER_INTERVAL_SEC) || 300;       // segundos

    // Defaults para API Oficial (muito mais rápidos)
    let officialApiMessageInterval = 1; // 1 segundo padrão

    settings.forEach(s => {
      try {
        const v = s.value ? JSON.parse(s.value) : null;
        if (s.key === "messageInterval" && v != null) messageInterval = Number(v);
        if (s.key === "longerIntervalAfter" && v != null) longerIntervalAfter = Number(v);
        if (s.key === "greaterInterval" && v != null) greaterInterval = Number(v);
        if (s.key === "officialApiMessageInterval" && v != null) officialApiMessageInterval = Number(v);
      } catch { }
    });

    // Se for API Oficial, usar configurações otimizadas da interface
    if (isOfficialApi) {
      return {
        messageIntervalMs: Math.max(0, officialApiMessageInterval) * 1000,
        longerIntervalAfter: 100, // Pausa longa após 100 mensagens
        greaterIntervalMs: 30000,  // Pausa de 30 segundos
      };
    }

    // Baileys usa configurações conservadoras
    return {
      messageIntervalMs: Math.max(0, messageInterval) * 1000,
      longerIntervalAfter: Math.max(0, longerIntervalAfter),
      greaterIntervalMs: Math.max(0, greaterInterval) * 1000,
    };
  } catch {
    if (isOfficialApi) {
      return {
        messageIntervalMs: 1000, // 1 segundo
        longerIntervalAfter: 100,
        greaterIntervalMs: 30000
      };
    }
    return {
      messageIntervalMs: (Number(process.env.MESSAGE_INTERVAL_SEC) || 60) * 1000,
      longerIntervalAfter: Number(process.env.LONGER_INTERVAL_AFTER) || 10,
      greaterIntervalMs: (Number(process.env.GREATER_INTERVAL_SEC) || 300) * 1000
    };
  }
}

function getPacingDeferDelayMs(whatsappId: number, s: IntervalSettings): number {
  const now = Date.now();
  const st = pacingMap.get(whatsappId) || { sentSinceLonger: 0 } as PacingState;

  // Se está bloqueado por pausa longa
  if (st.blockedUntil && st.blockedUntil > now) {
    return (st.blockedUntil - now) + randomValue(100, 300);
  }

  // Se atingiu o limite de mensagens desde a última pausa longa, agenda uma nova pausa
  if (s.longerIntervalAfter > 0 && (st.sentSinceLonger || 0) >= s.longerIntervalAfter) {
    st.blockedUntil = now + s.greaterIntervalMs;
    st.sentSinceLonger = 0;
    pacingMap.set(whatsappId, st);
    return (st.blockedUntil - now) + randomValue(50, 150);
  }

  // Respeita intervalo mínimo entre mensagens
  if (st.lastSentAt) {
    const elapsed = now - st.lastSentAt;
    if (elapsed < s.messageIntervalMs) {
      return (s.messageIntervalMs - elapsed) + randomValue(100, 300);
    }
  }

  pacingMap.set(whatsappId, st);
  return 0;
}

function updatePacingOnSuccess(whatsappId: number, s: IntervalSettings) {
  const st = pacingMap.get(whatsappId) || { sentSinceLonger: 0 } as PacingState;
  st.lastSentAt = Date.now();
  st.sentSinceLonger = (st.sentSinceLonger || 0) + 1;
  pacingMap.set(whatsappId, st);
}

function updateBackoffOnError(whatsappId: number, caps: CapBackoffSettings, errMsg: string) {
  const patterns = /(too many|rate|limi|429|ban|block|spam)/i;
  const isRateLike = patterns.test(errMsg || "");
  const now = Date.now();
  const current = backoffMap.get(whatsappId) || { count: 0, lastErrorAt: 0 };
  if (!isRateLike) {
    // não conta como erro de rate-limit/ban
    backoffMap.set(whatsappId, { count: 0, lastErrorAt: now, pausedUntil: current.pausedUntil });
    return;
  }
  const count = (current.count || 0) + 1;
  const pausedUntil = count >= caps.backoffErrorThreshold
    ? now + caps.backoffPauseMinutes * 60 * 1000
    : current.pausedUntil;
  backoffMap.set(whatsappId, { count, lastErrorAt: now, pausedUntil });
}

// ==== Blacklist / Suppression List Helpers ====
async function getSuppressionTagNames(companyId: number): Promise<string[]> {
  try {
    const setting = await CampaignSetting.findOne({
      where: { companyId, key: "suppressionTagNames" }
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => String(s));
      }
    }
  } catch (e) {
    // ignore parse errors, fallback to defaults
  }
  // Padrões comuns de DNC/Opt-out (case-insensitive)
  return [
    "DNC",
    "OPT-OUT",
    "OPTOUT",
    "STOP",
    "SAIR",
    "CANCELAR",
    "REMOVER",
    "DESCADASTRAR"
  ];
}

async function isNumberSuppressed(number: string, companyId: number): Promise<boolean> {
  try {
    const contact = await Contact.findOne({
      where: { number, companyId },
      include: [{ model: Tag, through: { attributes: [] } }]
    });
    if (!contact) return false;
    // Apenas regras de TAG de supressão (DNC/OPT-OUT/STOP/SAIR/etc.)
    const suppressionNames = (await getSuppressionTagNames(companyId)).map(s => s.toLowerCase());
    const names = (contact as any).tags?.map((t: any) => (t?.name || "").toLowerCase()) || [];
    return names.some(n => suppressionNames.includes(n));
  } catch (e) {
    return false;
  }
}

function resetBackoffOnSuccess(whatsappId: number) {
  const current = backoffMap.get(whatsappId);
  if (current) {
    backoffMap.set(whatsappId, { count: 0, lastErrorAt: Date.now(), pausedUntil: current.pausedUntil });
  }
}

async function verifyAndFinalizeCampaign(campaign) {
  const { companyId, contacts } = campaign.contactList;

  const count1 = contacts.length;

  // Finalizar quando TODOS os registros estiverem em estado terminal.
  // Importante para evitar loop infinito quando algum contato falha (ex.: número inválido).
  const terminalCount = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      [Op.or]: [
        { deliveredAt: { [Op.ne]: null } },
        { status: { [Op.in]: ["delivered", "failed", "suppressed"] } }
      ]
    }
  });

  if (count1 === terminalCount) {
    await campaign.update({ status: "FINALIZADA", completedAt: moment() });
  }

  const io = getIO();
  io.of(`/workspace-${campaign.companyId}`)
    .emit(`company-${campaign.companyId}-campaign`, {
      action: "update",
      record: campaign
    });
}

async function handleProcessCampaign(job) {
  try {
    const { id }: ProcessCampaignData = job.data;
    const campaign = await getCampaign(id);
    if (!campaign) {
      logger.error(`[ProcessCampaign] Campanha ${id} não encontrada, ignorando job.`);
      return;
    }
    const settings = await getSettings(campaign);
    if (campaign) {
      // Verificação de segurança para contactList
      if (!campaign.contactList || !campaign.contactListId) {
        logger.error(`[ProcessCampaign] Campanha ${id} não tem contactList associada`);
        return;
      }

      // IMPORTANTE: Carregar contatos diretamente do banco
      // (não vem mais via getCampaign para evitar sobrecarga)
      const contacts = await ContactListItem.findAll({
        where: { contactListId: campaign.contactListId },
        attributes: ["id", "name", "number", "email", "isWhatsappValid", "isGroup"]
      });
      logger.info(`[ProcessCampaign] Campanha ${id} | ContactList: ${campaign.contactList.id} | Total de contatos: ${contacts.length}`);

      if (!isArray(contacts) || contacts.length === 0) {
        logger.warn(`[ProcessCampaign] Campanha ${id} não tem contatos na lista. Verifique se a lista tem contatos válidos.`);
        return;
      }

      // Processar contatos da lista
      const contactData = contacts.map(contact => ({
        contactId: contact.id,
        campaignId: campaign.id,
        variables: settings.variables,
        isGroup: contact.isGroup
      }));

      // const baseDelay = job.data.delay || 0;
      // longerIntervalAfter representa após quantas mensagens aplicar o intervalo maior (contagem)
      const longerIntervalAfter = settings.longerIntervalAfter;
      // intervals em milissegundos
      const greaterIntervalMs = parseToMilliseconds(settings.greaterInterval);
      const messageIntervalMs = parseToMilliseconds(settings.messageInterval);
      // mesmos intervals em segundos para incrementar a data base
      const greaterIntervalSec = settings.greaterInterval;
      const messageIntervalSec = settings.messageInterval;

      let baseDelay = campaign.scheduledAt;

      // const isOpen = await checkTime();
      // const isFds = await checkerWeek();

      const queuePromises = [];
      for (let i = 0; i < contactData.length; i++) {
        baseDelay = addSeconds(baseDelay as any, (i > longerIntervalAfter ? greaterIntervalSec : messageIntervalSec) as any);

        const { contactId, campaignId, variables } = contactData[i];
        const delay = calculateDelay(i, baseDelay, longerIntervalAfter, greaterIntervalMs, messageIntervalMs);
        // if (isOpen || !isFds) {
        const queuePromise = campaignQueue.add(
          "PrepareContact",
          { contactId, campaignId, variables, delay },
          { removeOnComplete: true }
        );
        queuePromises.push(queuePromise);
        logger.info(`Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`);
      }
      await Promise.all(queuePromises);
    }
  } catch (err: any) {
    Sentry.captureException(err);
  }
}

function calculateDelay(
  index: number,
  baseDelay: Date,
  longerIntervalAfterCount: number,
  greaterIntervalMs: number,
  messageIntervalMs: number
) {
  const diffMs = differenceInSeconds(baseDelay, new Date()) * 1000;
  const baseInterval = (index + 1) > longerIntervalAfterCount ? greaterIntervalMs : messageIntervalMs;
  // jitter anti-spam: 0-2000ms
  const jitterMs = randomValue(0, 2000);
  return diffMs + baseInterval + jitterMs;
}

const rrIndexByCampaign: Map<number, number> = new Map();

async function pickNextWhatsapp(campaign: any): Promise<number> {
  try {
    let allowed: number[] | null = null;
    if (campaign?.allowedWhatsappIds) {
      if (typeof campaign.allowedWhatsappIds === "string") {
        try {
          const parsed = JSON.parse(campaign.allowedWhatsappIds);
          if (Array.isArray(parsed)) allowed = parsed.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
        } catch { }
      } else if (Array.isArray(campaign.allowedWhatsappIds)) {
        allowed = campaign.allowedWhatsappIds.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v));
      }
    }
    let candidates: any[] = [];
    if (allowed && allowed.length > 0) {
      candidates = await Whatsapp.findAll({ where: { id: allowed, companyId: campaign.companyId, status: "CONNECTED" } });
    } else {
      candidates = await Whatsapp.findAll({ where: { companyId: campaign.companyId, status: "CONNECTED" } });
    }
    if (!candidates || candidates.length === 0) {
      return campaign.whatsappId; // fallback
    }
    const key = Number(campaign.id);
    const idx = rrIndexByCampaign.get(key) || 0;
    const chosen = candidates[idx % candidates.length];
    rrIndexByCampaign.set(key, (idx + 1) % candidates.length);
    return chosen.id;
  } catch {
    return campaign.whatsappId;
  }
}

async function handlePrepareContact(job) {
  try {
    const { contactId, campaignId, delay, variables }: PrepareContactData =
      job.data;
    const campaign = await getCampaign(campaignId);

    // Verificação de segurança: campanha deve existir
    if (!campaign) {
      logger.error(`[PrepareContact] Campanha ${campaignId} não encontrada, ignorando job.`);
      return;
    }

    const contact = await getContact(contactId);

    // Verificação de segurança: contato deve existir
    if (!contact) {
      logger.error(`[PrepareContact] Contato ${contactId} não encontrado, ignorando job.`);
      return;
    }

    const campaignShipping: any = {};
    campaignShipping.number = contact.number;
    campaignShipping.contactId = contactId;
    campaignShipping.campaignId = campaignId;
    const messages = getCampaignValidMessages(campaign) || [];

    if (messages.length >= 0) {
      const radomIndex = randomValue(0, messages.length);

      // Enriquecer dados do contato com informações do CRM (Contact)
      let enrichedContact: any = contact;
      try {
        const crmContact = await Contact.findOne({ where: { number: campaignShipping.number, companyId: campaign.companyId } });
        if (crmContact) {
          enrichedContact = { ...contact, ...(crmContact as any).dataValues };
        }
      } catch { }

      const message = getProcessedMessage(
        messages[radomIndex] || "",
        variables,
        enrichedContact
      );

      campaignShipping.message = message === null ? "" : `\u200c ${message}`;
      // Salva o índice da mensagem (1..5) para uso de mídia por mensagem
      campaignShipping.messageIndex = (radomIndex || 0) + 1;
    }
    if (campaign.confirmation) {
      const confirmationMessages =
        getCampaignValidConfirmationMessages(campaign) || [];
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        let enrichedContact: any = contact;
        try {
          const crmContact = await Contact.findOne({ where: { number: campaignShipping.number, companyId: campaign.companyId } });
          if (crmContact) {
            enrichedContact = { ...contact, ...(crmContact as any).dataValues };
          }
        } catch { }
        const message = getProcessedMessage(
          confirmationMessages[radomIndex] || "",
          variables,
          enrichedContact
        );
        campaignShipping.confirmationMessage = `\u200c ${message}`;
      }
    }
    // Verifica supressão antes de prosseguir
    const suppressed = await isNumberSuppressed(campaignShipping.number, campaign.companyId);

    const [record, created] = await CampaignShipping.findOrCreate({
      where: {
        campaignId: campaignShipping.campaignId,
        contactId: campaignShipping.contactId
      },
      defaults: campaignShipping
    });

    if (!created) {
      // Se já foi entregue ou tem status final, não reagendar
      if (
        record.deliveredAt !== null ||
        record.status === "delivered" ||
        record.status === "failed" ||
        record.status === "suppressed"
      ) {
        logger.info(
          `[PrepareContact] Registro já finalizado (status=${record.status}, deliveredAt=${record.deliveredAt}). Campanha=${campaign.id}; Registro=${record.id}`
        );
        await verifyAndFinalizeCampaign(campaign);
        return;
      }

      // Atualiza dados se ainda não finalizado
      record.set(campaignShipping);
      await record.save();
    }

    if (suppressed) {
      await record.update({ deliveredAt: moment(), jobId: null });
      logger.warn(`Contato suprimido (opt-out/blacklist). Ignorando envio: Campanha=${campaign.id};Contato=${campaignShipping.number}`);
      await verifyAndFinalizeCampaign(campaign);
      return;
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null &&
      !["delivered", "failed", "suppressed"].includes(record.status)
    ) {
      // Seleciona a conexão por contato se a estratégia da campanha for round_robin
      let selectedWhatsappId = campaign.whatsappId;
      if (campaign?.dispatchStrategy === "round_robin") {
        selectedWhatsappId = await pickNextWhatsapp(campaign);
      }
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId,
          selectedWhatsappId
        },
        {
          delay
        }
      );

      await record.update({ jobId: String(nextJob.id) });
    }

    await verifyAndFinalizeCampaign(campaign);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

async function handleDispatchCampaign(job) {
  try {
    const { data } = job;
    const { campaignShippingId, campaignId } = data as any;
    const campaign = await getCampaign(campaignId);

    // Se a campanha foi pausada/cancelada/finalizada, não deve continuar tentando enviar.
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      try {
        const record = campaignShippingId ? await CampaignShipping.findByPk(campaignShippingId) : null;
        if (record) {
          await record.update({ jobId: null });
        }
      } catch { }

      if (campaign) {
        await verifyAndFinalizeCampaign(campaign);
      }
      return;
    }

    const selectedWhatsappId: number = (data as any)?.selectedWhatsappId || campaign.whatsappId;
    const whatsapp = await Whatsapp.findByPk(selectedWhatsappId);

    if (!whatsapp) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: whatsapp not found`);
      return;
    }

    const isOfficial = whatsapp.channelType === "official";
    const hasMetaTemplate = Boolean((campaign as any).metaTemplateName);

    // Para conexões não-oficiais (Baileys), seguimos usando wbot normalmente
    let wbot: any = null;
    if (!isOfficial) {
      wbot = await GetWhatsappWbot(whatsapp);

      if (!wbot) {
        logger.error(`campaignQueue -> DispatchCampaign -> error: wbot not found`);
        return;
      }

      if (!wbot?.user?.id) {
        logger.error(`campaignQueue -> DispatchCampaign -> error: wbot user not found`);
        return;
      }
    }

    logger.info(
      `Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}`
    );

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );

    if (!campaignShipping || !campaignShipping.number) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: campaignShipping not found or number missing (id=${campaignShippingId})`);
      return;
    }

    // Atualiza status para processando
    await campaignShipping.update({ status: 'processing' });

    // Checagem de supressão antes do envio
    const suppressed = await isNumberSuppressed(campaignShipping.number, campaign.companyId);
    if (suppressed) {
      await campaignShipping.update({
        deliveredAt: moment(),
        status: 'suppressed',
        lastError: 'Contato na lista de supressão (DNC/Opt-out)'
      });
      await verifyAndFinalizeCampaign(campaign);
      logger.warn(`Contato suprimido (opt-out/blacklist). Não enviado: Campanha=${campaignId};Contato=${campaignShipping.number}`);
      return;
    }

    // Cap, Backoff e Pacing por conexão (whatsappId)
    // API Oficial: pacing muito mais rápido vs Baileys
    // API Oficial também tem caps muito mais altos (Meta permite milhares por dia)
    const caps = await getCapBackoffSettings(campaign.companyId, isOfficial);
    const intervals = await getIntervalSettings(campaign.companyId, isOfficial);

    const capDelayMs = await getCapDeferDelayMs(selectedWhatsappId, caps);
    const backoffDelayMs = getBackoffDeferDelayMs(selectedWhatsappId);
    const pacingDelayMs = getPacingDeferDelayMs(selectedWhatsappId, intervals);
    const deferMs = Math.max(capDelayMs, backoffDelayMs, pacingDelayMs);
    if (deferMs > 0) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        { campaignId, campaignShippingId, contactListItemId: data.contactListItemId, selectedWhatsappId },
        { delay: deferMs, removeOnComplete: true }
      );
      await campaignShipping.update({ jobId: String(nextJob.id) });
      logger.warn(`Cap/Backoff/Pacing ativo. Reagendando envio: Campanha=${campaignId}; Registro=${campaignShippingId}; delay=${deferMs}ms; cap=${capDelayMs}; backoff=${backoffDelayMs}; pacing=${pacingDelayMs}`);
      return;
    }
    logger.info(
      `Sem deferimento: prosseguindo com envio imediato. Campanha=${campaignId}; Registro=${campaignShippingId}; capDelayMs=${capDelayMs}; backoffDelayMs=${backoffDelayMs}; pacingDelayMs=${pacingDelayMs}`
    );

    const isGroup = Boolean(campaignShipping.contact && campaignShipping.contact.isGroup);
    const chatId = isGroup
      ? `${campaignShipping.number}@g.us`
      : `${campaignShipping.number}@s.whatsapp.net`;

    // ===== Caminho API Oficial com Template Meta =====
    const useOfficialTemplate = isOfficial && hasMetaTemplate;

    // Se conexão é API Oficial mas campanha não tem template Meta configurado,
    // não podemos usar wbot (Baileys) e nem enviar mensagem livre sem controle.
    // Nesses casos, marcamos o envio como falho com uma mensagem clara.
    if (isOfficial && !useOfficialTemplate) {
      const errorMsg = "Campanha com API Oficial requer template Meta configurado (metaTemplateName).";
      logger.error(
        `[DispatchCampaign] Conexão API Oficial (whatsappId=${selectedWhatsappId}) sem metaTemplateName configurado. Campanha=${campaignId}; Registro=${campaignShippingId}`
      );
      await campaignShipping.update({
        status: 'failed',
        attempts: (campaignShipping.attempts || 0) + 1,
        lastError: errorMsg,
        lastErrorAt: moment().toDate()
      });
      await verifyAndFinalizeCampaign(campaign);
      return;
    }

    if (useOfficialTemplate) {
      const templateName = (campaign as any).metaTemplateName as string;
      const languageCode = ((campaign as any).metaTemplateLanguage as string) || "pt_BR";

      try {
        // REGRA UNIFICADA: TODA campanha cria ticket "campaign" primeiro
        // Exceto se já existe ticket "open" - nesse caso, reusar e apenas registrar mensagem
        {
          // Cria/usa contato no CRM
          const { canonical: canonicalNumber } = safeNormalizePhoneNumber(String(campaignShipping.number || ""));
          const normalizedNumber = canonicalNumber || String(campaignShipping.number || "");
          const [contact] = await Contact.findOrCreate({
            where: {
              number: normalizedNumber,
              companyId: campaign.companyId
            },
            defaults: {
              companyId: campaign.companyId,
              name: campaignShipping.contact.name,
              number: normalizedNumber,
              email: campaignShipping.contact.email,
              whatsappId: selectedWhatsappId,
              profilePicUrl: ""
            }
          });

          // Verificar se já existe ticket OPEN para este contato
          const existingOpenTicket = await Ticket.findOne({
            where: {
              contactId: contact.id,
              whatsappId: selectedWhatsappId,
              companyId: campaign.companyId,
              status: "open"
            }
          });

          // Parsear metaTemplateVariables se vier como string
          let variablesConfig = (campaign as any).metaTemplateVariables;
          if (typeof variablesConfig === 'string') {
            try {
              variablesConfig = JSON.parse(variablesConfig);
            } catch (e) {
              logger.warn(`[DispatchCampaign] Erro ao parsear metaTemplateVariables: ${e}`);
              variablesConfig = undefined;
            }
          }
          logger.info(`[DispatchCampaign][Official] metaTemplateVariables: ${JSON.stringify(variablesConfig)}`);

          // Mapear parâmetros do template se houver configuração
          let templateComponents = undefined;
          if (variablesConfig && Object.keys(variablesConfig).length > 0) {
            try {
              const templateDef = await GetTemplateDefinition(
                selectedWhatsappId,
                templateName,
                languageCode
              );
              if (templateDef.parameters.length > 0) {
                templateComponents = MapTemplateParameters(
                  templateDef.parameters,
                  contact,
                  variablesConfig
                );
                logger.info(`[DispatchCampaign] Template mapeado com ${templateDef.parameters.length} parâmetros`);
              }
            } catch (e) {
              logger.warn(`[DispatchCampaign] Erro ao mapear template: ${e}`);
            }
          }

          // NOVO: Se template tem header com mídia, adicionar componente header
          // e guardar info para salvar mídia no histórico
          let templateHeaderMediaType: string | null = null;
          let templateHeaderHandle: string | null = null;
          let templateBodyText: string = "";
          try {
            const templateDef = await GetTemplateDefinition(selectedWhatsappId, templateName, languageCode);

            // Extrair texto do body do template
            templateBodyText = templateDef.body || "";

            // Substituir variáveis {{1}}, {{2}}, etc. pelos valores reais
            if (templateComponents && Array.isArray(templateComponents)) {
              const bodyComponent = templateComponents.find((c: any) => c.type === "body");
              if (bodyComponent && bodyComponent.parameters) {
                bodyComponent.parameters.forEach((param: any, index: number) => {
                  const placeholder = `{{${index + 1}}}`;
                  const value = param.text || "";
                  templateBodyText = templateBodyText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
                });
              }
            }

            if (templateDef.headerFormat &&
              ["DOCUMENT", "IMAGE", "VIDEO"].includes(templateDef.headerFormat) &&
              templateDef.headerHandle) {
              logger.info(`[DispatchCampaign] Template tem header ${templateDef.headerFormat}, incluindo no payload`);
              templateHeaderMediaType = templateDef.headerFormat.toLowerCase();
              templateHeaderHandle = templateDef.headerHandle;
              const headerComponent = {
                type: "header",
                parameters: [{
                  type: templateDef.headerFormat.toLowerCase(),
                  [templateDef.headerFormat.toLowerCase()]: {
                    link: templateDef.headerHandle
                  }
                }]
              };
              if (templateComponents && Array.isArray(templateComponents)) {
                templateComponents = [headerComponent, ...templateComponents];
              } else {
                templateComponents = [headerComponent];
              }
            }
          } catch (err: any) {
            logger.warn(`[DispatchCampaign] Erro ao processar header do template: ${err.message}`);
          }

          // Determinar usuário baseado nas tags do contato (se múltiplos usuários configurados)
          let targetUserId = campaign.userId || null;
          if ((campaign as any).userIds) {
            try {
              const userIdsArray = typeof (campaign as any).userIds === 'string'
                ? JSON.parse((campaign as any).userIds)
                : (campaign as any).userIds;

              if (Array.isArray(userIdsArray) && userIdsArray.length > 0) {
                const matchedUserId = await getUserIdByContactTags(contact.id, userIdsArray, campaign.companyId);
                if (matchedUserId) {
                  targetUserId = matchedUserId;
                  logger.info(`[DispatchCampaign][Official] Usuário ${targetUserId} selecionado por tag para contato ${contact.id}`);
                } else {
                  targetUserId = null;
                  logger.info(`[DispatchCampaign][Official] Sem match de tag, ticket ficará sem usuário específico`);
                }
              }
            } catch (e) {
              logger.warn(`[DispatchCampaign][Official] Erro ao processar userIds: ${e}`);
            }
          }

          let ticket: Ticket;

          if (existingOpenTicket) {
            // REGRA: Se já existe ticket OPEN, reusar e apenas registrar mensagem
            ticket = existingOpenTicket;
            logger.info(`[DispatchCampaign][Official] Reusando ticket OPEN #${ticket.id} para contato ${contact.id}`);
          } else {
            // REGRA: Criar ticket com status "campaign" primeiro
            ticket = await FindOrCreateTicketService(
              contact,
              whatsapp,
              0, // unreadMessages
              campaign.companyId,
              campaign.queueId,
              null, // userId - sem usuário atribuído inicialmente
              null, // groupContact
              "whatsapp", // channel
              false, // isImported
              false, // isForward
              null, // settings
              false, // isTransfered
              true // isCampaign
            );

            // Forçar status "campaign" mas PRESERVAR userId para carteiras
            await ticket.update({
              status: "campaign",
              userId: targetUserId, // IMPORTANTE: preservar carteira do usuário
              queueId: campaign.queueId || ticket.queueId
            });
            ticket = await ShowTicketService(ticket.id, campaign.companyId);
            logger.info(`[DispatchCampaign][Official] Ticket #${ticket.id} criado com status "campaign", fila=${campaign.queueId}, userId=${targetUserId} (carteira)`);
          }

          // Enviar template
          const adapter = await GetWhatsAppAdapter(whatsapp);
          if (typeof adapter.sendTemplate === "function") {
            const sentMessage = await adapter.sendTemplate(
              campaignShipping.number,
              templateName,
              languageCode,
              templateComponents
            );

            // Salvar mensagem no banco para aparecer no histórico do ticket
            const messageId = sentMessage?.id || `campaign-${Date.now()}`;
            await CreateMessageService({
              messageData: {
                wid: messageId,
                ticketId: ticket.id,
                contactId: contact.id,
                body: templateBodyText || campaignShipping.message || `Template: ${templateName}`,
                fromMe: true,
                // Se o template tinha header de mídia, salvar mediaUrl/mediaType para exibir no ticket
                mediaType: templateHeaderMediaType || "extendedTextMessage",
                mediaUrl: templateHeaderHandle || undefined,
                read: true,
                ack: 1,
                remoteJid: contact.remoteJid,
                isCampaign: true // Não emite para a sala (evita notificação)
              },
              companyId: campaign.companyId
            });
            logger.info(`[DispatchCampaign][Official] Template ${templateName} enviado para ticket #${ticket.id}`);
          } else {
            logger.error("[DispatchCampaign][Official] Adapter oficial não suporta sendTemplate");
            throw new Error("Adapter oficial não suporta sendTemplate");
          }
        }

        await campaignShipping.update({
          deliveredAt: moment(),
          status: 'delivered',
          attempts: (campaignShipping.attempts || 0) + 1
        });
        resetBackoffOnSuccess(selectedWhatsappId);
        updatePacingOnSuccess(selectedWhatsappId, intervals);

      } catch (err: any) {
        logger.error(`[DispatchCampaign][OfficialTemplate] Erro ao enviar template: ${err.message}`);
        throw err;
      }
    } else {
      // REGRA UNIFICADA BAILEYS: TODA campanha cria ticket "campaign" primeiro
      // Exceto se já existe ticket "open" - nesse caso, reusar e apenas registrar mensagem
      const { canonical: canonicalNumber } = safeNormalizePhoneNumber(String(campaignShipping.number || ""));
      const normalizedNumber = canonicalNumber || String(campaignShipping.number || "");
      const [contact] = await Contact.findOrCreate({
        where: {
          number: normalizedNumber,
          companyId: campaign.companyId
        },
        defaults: {
          companyId: campaign.companyId,
          name: campaignShipping.contact.name,
          number: normalizedNumber,
          email: campaignShipping.contact.email,
          whatsappId: selectedWhatsappId,
          profilePicUrl: ""
        }
      });

      // Verificar se já existe ticket OPEN para este contato
      const existingOpenTicket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          whatsappId: selectedWhatsappId,
          companyId: campaign.companyId,
          status: "open"
        }
      });

      // Determinar usuário baseado nas tags do contato (se múltiplos usuários configurados)
      let targetUserId = campaign.userId || null;
      if ((campaign as any).userIds) {
        try {
          const userIdsArray = typeof (campaign as any).userIds === 'string'
            ? JSON.parse((campaign as any).userIds)
            : (campaign as any).userIds;

          if (Array.isArray(userIdsArray) && userIdsArray.length > 0) {
            const matchedUserId = await getUserIdByContactTags(contact.id, userIdsArray, campaign.companyId);
            if (matchedUserId) {
              targetUserId = matchedUserId;
              logger.info(`[DispatchCampaign][Baileys] Usuário ${targetUserId} selecionado por tag para contato ${contact.id}`);
            } else {
              targetUserId = null;
              logger.info(`[DispatchCampaign][Baileys] Sem match de tag, ticket ficará sem usuário específico`);
            }
          }
        } catch (e) {
          logger.warn(`[DispatchCampaign][Baileys] Erro ao processar userIds: ${e}`);
        }
      }

      let ticket: Ticket;

      if (existingOpenTicket) {
        // REGRA: Se já existe ticket OPEN, reusar e apenas registrar mensagem
        ticket = existingOpenTicket;
        logger.info(`[DispatchCampaign][Baileys] Reusando ticket OPEN #${ticket.id} para contato ${contact.id}`);
      } else {
        // REGRA: Criar ticket com status "campaign" primeiro
        ticket = await FindOrCreateTicketService(
          contact,
          whatsapp,
          0, // unreadMessages
          campaign.companyId,
          campaign.queueId,
          null, // userId - sem usuário atribuído inicialmente
          null, // groupContact
          "whatsapp", // channel
          false, // isImported
          false, // isForward
          null, // settings
          false, // isTransfered
          true // isCampaign
        );

        // Forçar status "campaign" mas PRESERVAR userId para carteiras
        await ticket.update({
          status: "campaign",
          userId: targetUserId, // IMPORTANTE: preservar carteira do usuário
          queueId: campaign.queueId || ticket.queueId
        });
        ticket = await ShowTicketService(ticket.id, campaign.companyId);
        logger.info(`[DispatchCampaign][Baileys] Ticket #${ticket.id} criado com status "campaign", fila=${campaign.queueId}, userId=${targetUserId} (carteira)`);
      }

      // Verificar se o socket Baileys está REALMENTE aberto antes de enviar
      // O status no banco pode estar "CONNECTED" mas o WebSocket pode ter caído
      let isSocketReady = false;
      try {
        const ws = (wbot as any).ws;
        if (ws) {
          const socket = ws.socket || ws;
          const readyState = socket?.readyState;
          isSocketReady = readyState === 1; // WebSocket.OPEN = 1
          if (!isSocketReady) {
            const stateNames = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
            logger.warn(`[DispatchCampaign][Baileys] WebSocket não está aberto. readyState=${readyState} (${stateNames[readyState] || "UNKNOWN"}). Reagendando...`);
          }
        } else {
          // Fallback: verificar se user está definido
          isSocketReady = !!(wbot as any).user;
        }
      } catch (e) {
        logger.warn(`[DispatchCampaign][Baileys] Erro ao verificar estado do socket: ${e?.message}`);
        isSocketReady = false;
      }

      // Se socket não está pronto, reagendar com delay ao invés de falhar
      if (!isSocketReady) {
        const delayMs = 10000; // 10 segundos para dar tempo de reconectar
        const nextJob = await campaignQueue.add(
          "DispatchCampaign",
          { campaignId, campaignShippingId, contactListItemId: data.contactListItemId, selectedWhatsappId },
          { delay: delayMs, removeOnComplete: true }
        );
        await campaignShipping.update({
          jobId: String(nextJob.id),
          status: 'pending',
          lastError: 'WebSocket não está aberto, reagendando...',
          lastErrorAt: moment().toDate()
        });
        logger.warn(`[DispatchCampaign][Baileys] Socket não pronto. Job reagendado em ${delayMs}ms. Campanha=${campaignId}; Registro=${campaignShippingId}`);
        return;
      }

      if (whatsapp.status === "CONNECTED") {
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          const confirmationMessage = await wbot.sendMessage(chatId, {
            text: `\u200c ${campaignShipping.confirmationMessage}`
          });

          await verifyMessage(confirmationMessage, ticket, contact, null, true, false, true); // isCampaign=true

          await campaignShipping.update({ confirmationRequestedAt: moment() });
        } else {

          // Seleciona mídia por mensagem (prioridade) ou global (fallback)
          const msgIdx: number | undefined = (campaignShipping as any).messageIndex;
          const perUrl: string | null = msgIdx ? (campaign as any)[`mediaUrl${msgIdx}`] : null;
          const perName: string | null = msgIdx ? (campaign as any)[`mediaName${msgIdx}`] : null;

          const publicFolder = path.resolve(__dirname, "..", "public");
          const urlToLocalPath = (url: string | null | undefined): string | null => {
            try {
              if (!url) return null;
              let p = url as string;
              if (/^https?:\/\//i.test(p)) {
                const u = new URL(p);
                p = u.pathname;
              }
              const marker = "/public/";
              const idx = p.indexOf(marker);
              if (idx >= 0) {
                const rel = p.substring(idx + marker.length);
                return path.join(publicFolder, rel);
              }
              // casos: "/companyX/arquivo" ou "companyX/arquivo"
              p = p.replace(/^\/+/, "");
              return path.join(publicFolder, p);
            } catch {
              return null;
            }
          };

          const perMessageFilePath = urlToLocalPath(perUrl);
          const hasPerMessageMedia = Boolean(perMessageFilePath && perName);

          if (!hasPerMessageMedia && !campaign.mediaPath) {
            const sentMessage = await wbot.sendMessage(chatId, {
              text: `\u200c ${campaignShipping.message}`
            });

            await verifyMessage(sentMessage, ticket, contact, null, true, false, true); // isCampaign=true
          }

          if (hasPerMessageMedia || campaign.mediaPath) {
            const filePath = hasPerMessageMedia
              ? (perMessageFilePath as string)
              : path.join(publicFolder, `company${campaign.companyId}`, campaign.mediaPath);

            const fileName = hasPerMessageMedia ? (perName as string) : campaign.mediaName;
            const options = await getMessageOptions(fileName, filePath, String(campaign.companyId), `\u200c ${campaignShipping.message}`);
            if (Object.keys(options).length) {
              if (options.mimetype === "audio/mp4") {
                const audioMessage = await wbot.sendMessage(chatId, {
                  text: `\u200c ${campaignShipping.message}`
                });

                await verifyMessage(audioMessage, ticket, contact, null, true, false, true); // isCampaign=true
              }
              const sentMessage = await wbot.sendMessage(chatId, { ...options });

              // FIX: Ensure caption is present in the returned message object so verifyMediaMessage can save it
              if (sentMessage.message && options.caption) {
                if (sentMessage.message.videoMessage) {
                  sentMessage.message.videoMessage.caption = options.caption;
                } else if (sentMessage.message.imageMessage) {
                  sentMessage.message.imageMessage.caption = options.caption;
                } else if (sentMessage.message.documentMessage) {
                  sentMessage.message.documentMessage.caption = options.caption;
                }
              }

              await verifyMediaMessage(sentMessage, ticket, ticket.contact, null, false, true, wbot, true); // isCampaign=true
            }
          }
          // Fechar ticket se statusTicket for "closed"
          if (campaign?.statusTicket === 'closed' && ticket.status !== 'closed') {
            await ticket.update({ status: "closed" });
            logger.info(`[DispatchCampaign] Ticket #${ticket.id} fechado conforme configuração da campanha`);
          }
        }
        await campaignShipping.update({
          deliveredAt: moment(),
          status: 'delivered',
          attempts: (campaignShipping.attempts || 0) + 1
        });
        // sucesso: zera backoff e atualiza pacing da conexão
        resetBackoffOnSuccess(selectedWhatsappId);
        updatePacingOnSuccess(selectedWhatsappId, intervals);
      }
    }
    await verifyAndFinalizeCampaign(campaign);

    const io = getIO();
    io.of(`/workspace-${campaign.companyId}`)
      .emit(`company-${campaign.companyId}-campaign`, {
        action: "update",
        record: campaign
      });

    // Log de monitoramento anti-ban
    const now = moment();
    const hourStart = now.clone().startOf("hour");
    const dayStart = now.clone().startOf("day");
    const hourlyCount = await countDeliveredSince(selectedWhatsappId, hourStart.toISOString());
    const dailyCount = await countDeliveredSince(selectedWhatsappId, dayStart.toISOString());

    logger.info(
      `✅ [ANTI-BAN] Mensagem enviada | Campanha=${campaignId} | Contato=${campaignShipping.contact.name} | WhatsApp=${selectedWhatsappId} | Hora: ${hourlyCount}/${caps.capHourly} | Dia: ${dailyCount}/${caps.capDaily}`
    );
  } catch (err: any) {
    try {
      Sentry.captureException(err);
      logger.error(err.message);
      // Atualiza estado de backoff da conexão e reagenda este job
      const campaignId = job?.data?.campaignId;
      const campaign = campaignId ? await getCampaign(campaignId) : null;
      if (campaign) {
        // Se a campanha não está em andamento, não reagendar.
        if (campaign.status !== "EM_ANDAMENTO") {
          try {
            const record = await CampaignShipping.findByPk((job?.data as any)?.campaignShippingId);
            if (record) {
              await record.update({ jobId: null });
            }
          } catch { }
          await verifyAndFinalizeCampaign(campaign);
          return;
        }

        const selectedWhatsappId: number = (job?.data as any)?.selectedWhatsappId || campaign.whatsappId;
        const whatsappForCaps = await Whatsapp.findByPk(selectedWhatsappId);
        const isOfficialForCaps = whatsappForCaps?.channelType === "official";
        const caps = await getCapBackoffSettings(campaign.companyId, isOfficialForCaps);
        updateBackoffOnError(selectedWhatsappId, caps, err?.message || "");
        const delayMs = getBackoffDeferDelayMs(selectedWhatsappId) || (caps.backoffPauseMinutes * 60 * 1000);
        const { campaignShippingId, contactListItemId } = job.data as DispatchCampaignData;
        const record = await CampaignShipping.findByPk(campaignShippingId);
        if (record) {
          const newAttempts = (record.attempts || 0) + 1;
          const maxAttempts = 5;

          // Se excedeu tentativas máximas, marca como falha permanente
          if (newAttempts >= maxAttempts) {
            await record.update({
              jobId: null,
              status: 'failed',
              attempts: newAttempts,
              lastError: `Falha após ${maxAttempts} tentativas: ${err?.message || 'Erro desconhecido'}`,
              lastErrorAt: moment().toDate()
            });
            logger.error(`[CAMPAIGN FAILED] Campanha=${campaign.id}; Registro=${campaignShippingId}; Tentativas=${newAttempts}; Erro=${err?.message}`);
            await verifyAndFinalizeCampaign(campaign);
            return;
          }

          const nextJob = await campaignQueue.add(
            "DispatchCampaign",
            { campaignId: campaign.id, campaignShippingId, contactListItemId, selectedWhatsappId },
            { delay: delayMs, removeOnComplete: true }
          );

          // Caso contrário, reagenda
          await record.update({
            jobId: String(nextJob.id),
            attempts: newAttempts,
            lastError: err?.message || 'Erro desconhecido',
            lastErrorAt: moment().toDate()
          });
        }
        logger.warn(`Erro no envio. Backoff aplicado e job reagendado em ${delayMs}ms. Campanha=${campaign.id}; Registro=${campaignShippingId}; Tentativa=${(record?.attempts || 0) + 1}`);
        return;
      }
    } catch (inner) {
      logger.error(`Erro ao aplicar backoff: ${inner?.message}`);
    }
    console.log(err.stack);
  }
}

async function handleLoginStatus(job) {
  const thresholdTime = new Date();
  thresholdTime.setMinutes(thresholdTime.getMinutes() - 5);

  await User.update({ online: false }, {
    where: {
      updatedAt: { [Op.lt]: thresholdTime },
      online: true,
    },
  });
}

async function handleResumeTicketsOutOfHour(job) {
  // logger.info("Buscando atendimentos perdidos nas filas");
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'name'],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"],
          where: {
            timeSendQueue: { [Op.gt]: 0 }
          }
        },
      ]
    });

    companies.map(async c => {

      c.whatsapps.map(async w => {

        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {

            if (!isNaN(idQueue) && Number.isInteger(idQueue) && !isNaN(timeQueue) && Number.isInteger(timeQueue)) {

              const tempoPassado = moment().subtract(timeQueue, "minutes").utc().format();
              // const tempoAgora = moment().utc().format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  },
                  // isOutOfHour: false
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "disableBot", "urlPicture", "lgpdAcceptedAt", "companyId"],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: ["id", "name", "expiresTicket", "groupAsTicket"]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await ticket.reload();

                  const io = getIO();
                  io.of(`/workspace-${companyId}`)
                    // .to("notification")
                    // .to(ticket.id.toString())
                    .emit(`company-${companyId}-ticket`, {
                      action: "update",
                      ticket,
                      ticketId: ticket.id
                    });

                  // io.to("pending").emit(`company-${companyId}-ticket`, {
                  //   action: "update",
                  //   ticket,
                  // });

                  logger.info(`Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`);
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
};

async function handleVerifyQueue(job) {
  // logger.info("Buscando atendimentos perdidos nas filas");
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'name'],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"]
        },
      ]
    });

    companies.map(async c => {

      c.whatsapps.map(async w => {

        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {

            if (!isNaN(idQueue) && Number.isInteger(idQueue) && !isNaN(timeQueue) && Number.isInteger(timeQueue)) {

              const tempoPassado = moment().subtract(timeQueue, "minutes").utc().format();
              // const tempoAgora = moment().utc().format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  },
                  // isOutOfHour: false
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "disableBot", "urlPicture", "lgpdAcceptedAt", "companyId"],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: ["id", "name", "expiresTicket", "groupAsTicket"]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await CreateLogTicketService({
                    userId: null,
                    queueId: idQueue,
                    ticketId: ticket.id,
                    type: "redirect"
                  });

                  await ticket.reload();

                  const io = getIO();
                  io.of(`/workspace-${companyId}`)
                    // .to("notification")
                    // .to(ticket.id.toString())
                    .emit(`company-${companyId}-ticket`, {
                      action: "update",
                      ticket,
                      ticketId: ticket.id
                    });

                  // io.to("pending").emit(`company-${companyId}-ticket`, {
                  //   action: "update",
                  //   ticket,
                  // });

                  logger.info(`Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`);
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
};

async function handleRandomUser() {
  // logger.info("Iniciando a randomização dos atendimentos...");

  const jobR = new CronJob('0 */2 * * * *', async () => {

    try {
      const companies = await Company.findAll({
        attributes: ['id', 'name'],
        where: {
          status: true
        },
        include: [
          {
            model: Queues,
            attributes: ["id", "name", "ativarRoteador", "tempoRoteador"],
            where: {
              ativarRoteador: true,
              tempoRoteador: {
                [Op.ne]: 0
              }
            }
          },
        ]
      });

      if (companies) {
        companies.map(async c => {
          c.queues.map(async q => {
            const { count, rows: tickets } = await Ticket.findAndCountAll({
              where: {
                companyId: c.id,
                status: "pending",
                queueId: q.id,
              },
            });

            //logger.info(`Localizado: ${count} filas para randomização.`);

            const getRandomUserId = (userIds) => {
              const randomIndex = Math.floor(Math.random() * userIds.length);
              return userIds[randomIndex];
            };

            // Function to fetch the User record by userId
            const findUserById = async (userId, companyId) => {
              try {
                const user = await User.findOne({
                  where: {
                    id: userId,
                    companyId
                  },
                });

                if (user && user?.profile === "user") {
                  if (user.online === true) {
                    return user.id;
                  } else {
                    // logger.info("USER OFFLINE");
                    return 0;
                  }
                } else {
                  // logger.info("ADMIN");
                  return 0;
                }

              } catch (errorV) {
                Sentry.captureException(errorV);
                logger.error("SearchForUsersRandom -> VerifyUsersRandom: error", errorV.message);
                throw errorV;
              }
            };

            if (count > 0) {
              for (const ticket of tickets) {
                const { queueId, userId } = ticket;
                const tempoRoteador = q.tempoRoteador;
                // Find all UserQueue records with the specific queueId
                const userQueues = await UserQueue.findAll({
                  where: {
                    queueId: queueId,
                  },
                });

                const contact = await ShowContactService(ticket.contactId, ticket.companyId);

                // Extract the userIds from the UserQueue records
                const userIds = userQueues.map((userQueue) => userQueue.userId);

                const tempoPassadoB = moment().subtract(tempoRoteador, "minutes").utc().toDate();
                const updatedAtV = new Date(ticket.updatedAt);

                let settings = await CompaniesSettings.findOne({
                  where: {
                    companyId: ticket.companyId
                  }
                });
                const sendGreetingMessageOneQueues = settings.sendGreetingMessageOneQueues === "enabled" || false;

                if (!userId) {
                  // ticket.userId is null, randomly select one of the provided userIds
                  const randomUserId = getRandomUserId(userIds);


                  if (randomUserId !== undefined && await findUserById(randomUserId, ticket.companyId) > 0) {
                    // Update the ticket with the randomly selected userId
                    //ticket.userId = randomUserId;
                    //ticket.save();

                    if (sendGreetingMessageOneQueues) {
                      const ticketToSend = await ShowTicketService(ticket.id, ticket.companyId);

                      await SendWhatsAppMessage({ body: `\u200e *Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!`, ticket: ticketToSend });

                    }

                    await UpdateTicketService({
                      ticketData: { status: "pending", userId: randomUserId },
                      ticketId: ticket.id,
                      companyId: ticket.companyId,

                    });

                    //await ticket.reload();
                    logger.info(`Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`);
                  } else {
                    //logger.info(`Ticket ID ${ticket.id} NOT updated with UserId ${randomUserId} - ${ticket.updatedAt}`);            
                  }

                } else if (userIds.includes(userId)) {
                  if (tempoPassadoB > updatedAtV) {
                    // ticket.userId is present and is in userIds, exclude it from random selection
                    const availableUserIds = userIds.filter((id) => id !== userId);

                    if (availableUserIds.length > 0) {
                      // Randomly select one of the remaining userIds
                      const randomUserId = getRandomUserId(availableUserIds);

                      if (randomUserId !== undefined && await findUserById(randomUserId, ticket.companyId) > 0) {
                        // Update the ticket with the randomly selected userId
                        //ticket.userId = randomUserId;
                        //ticket.save();

                        if (sendGreetingMessageOneQueues) {

                          const ticketToSend = await ShowTicketService(ticket.id, ticket.companyId);
                          await SendWhatsAppMessage({ body: "*Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!", ticket: ticketToSend });
                        };

                        await UpdateTicketService({
                          ticketData: { status: "pending", userId: randomUserId },
                          ticketId: ticket.id,
                          companyId: ticket.companyId,

                        });

                        logger.info(`Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`);
                      } else {
                        //logger.info(`Ticket ID ${ticket.id} NOT updated with UserId ${randomUserId} - ${ticket.updatedAt}`);            
                      }

                    }
                  }
                }

              }
            }
          })
        })
      }
    } catch (e) {
      Sentry.captureException(e);
      logger.error("SearchForUsersRandom -> VerifyUsersRandom: error", e.message);
      throw e;
    }

  });

  jobR.start();
}

async function handleProcessLanes() {
  const job = new CronJob('*/1 * * * *', async () => {
    const companies = await Company.findAll({
      include: [
        {
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "useKanban"],
          where: {
            useKanban: true
          }
        },
      ]
    });
    companies.map(async c => {

      try {
        const companyId = c.id;

        const ticketTags = await TicketTag.findAll({
          include: [{
            model: Ticket,
            as: "ticket",
            where: {
              status: "open",
              fromMe: true,
              companyId
            },
            attributes: ["id", "contactId", "updatedAt", "whatsappId"]
          }, {
            model: Tag,
            as: "tag",
            attributes: ["id", "timeLane", "nextLaneId", "greetingMessageLane"],
            where: {
              companyId
            }
          }]
        })

        if (ticketTags.length > 0) {
          ticketTags.map(async t => {
            if (!isNil(t?.tag.nextLaneId) && t?.tag.nextLaneId > 0 && t?.tag.timeLane > 0) {
              const nextTag = await Tag.findByPk(t?.tag.nextLaneId);

              const dataLimite = new Date();
              dataLimite.setHours(dataLimite.getHours() - Number(t.tag.timeLane));
              const dataUltimaInteracaoChamado = new Date(t.ticket.updatedAt)

              if (dataUltimaInteracaoChamado < dataLimite) {
                await TicketTag.destroy({ where: { ticketId: t.ticketId, tagId: t.tagId } });
                await TicketTag.create({ ticketId: t.ticketId, tagId: nextTag.id });

                const whatsapp = await Whatsapp.findByPk(t.ticket.whatsappId);

                if (!isNil(nextTag.greetingMessageLane) && nextTag.greetingMessageLane !== "") {
                  const bodyMessage = nextTag.greetingMessageLane;

                  const contact = await Contact.findByPk(t.ticket.contactId);
                  const ticketUpdate = await ShowTicketService(t.ticketId, companyId);

                  await SendMessage(whatsapp, {
                    number: contact.number,
                    body: `${formatBody(bodyMessage, ticketUpdate)}`,
                    mediaPath: null,
                    companyId: companyId
                  },
                    contact.isGroup
                  )
                }
              }
            }
          })
        }
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("Process Lanes -> Verify: error", e.message);
        throw e;
      }

    });
  });
  job.start()
}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob('*/1 * * * *', async () => {
    const companies = await Company.findAll({
      where: {
        status: true
      }
    });
    companies.map(async c => {

      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
        throw e;
      }

    });
  });
  job.start()
}

async function handleWhatsapp() {
  const jobW = new CronJob('* 15 3 * * *', async () => {
    //*Whatsapp
    GetWhatsapp();
    jobW.stop();
  }, null, false, 'America/Sao_Paulo')
  jobW.start();
}
async function handleInvoiceCreate() {
  const job = new CronJob('0 * * * * *', async () => {


    const companies = await Company.findAll();
    companies.map(async c => {
      var dueDate = c.dueDate;
      const date = moment(dueDate).format();
      const timestamp = moment().format();
      const hoje = moment(moment()).format("DD/MM/yyyy");
      var vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
      var dias = moment.duration(diff).asDays();

      if (dias < 20) {
        const plan = await Plan.findByPk(c.planId);

        const sql = `SELECT COUNT(*) mycount FROM "Invoices" WHERE "companyId" = ${c.id} AND "dueDate"::text LIKE '${moment(dueDate).format("yyyy-MM-DD")}%';`
        const invoice = await sequelize.query(sql,
          { type: QueryTypes.SELECT }
        );
        if (invoice[0]['mycount'] > 0) {

        } else {
          const sql = `INSERT INTO "Invoices" (detail, status, value, "updatedAt", "createdAt", "dueDate", "companyId")
          VALUES ('${plan.name}', 'open', '${plan.amount}', '${timestamp}', '${timestamp}', '${date}', ${c.id});`

          const invoiceInsert = await sequelize.query(sql,
            { type: QueryTypes.INSERT }
          );

          /*           let transporter = nodemailer.createTransport({
                      service: 'gmail',
                      auth: {
                        user: 'email@gmail.com',
                        pass: 'senha'
                      }
                    });
          
                    const mailOptions = {
                      from: 'heenriquega@gmail.com', // sender address
                      to: `${c.email}`, // receiver (use array of string for a list)
                      subject: 'Fatura gerada - Sistema', // Subject line
                      html: `Olá ${c.name} esté é um email sobre sua fatura!<br>
          <br>
          Vencimento: ${vencimento}<br>
          Valor: ${plan.value}<br>
          Link: ${process.env.FRONTEND_URL}/financeiro<br>
          <br>
          Qualquer duvida estamos a disposição!
                      `// plain text body
                    };
          
                    transporter.sendMail(mailOptions, (err, info) => {
                      if (err)
                        console.log(err)
                      else
                        console.log(info);
                    }); */

        }





      }

    });
  });
  job.start()
}


handleInvoiceCreate()

handleWhatsapp();
handleProcessLanes();
handleCloseTicketsAutomatic();
handleRandomUser();

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  messageQueue.process("SendMessage", handleSendMessage);

  scheduleMonitor.process("Verify", handleVerifySchedules);

  sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);

  campaignQueue.process("VerifyCampaignsDaatabase", handleVerifyCampaigns);

  campaignQueue.process("ProcessCampaign", handleProcessCampaign);

  campaignQueue.process("PrepareContact", handlePrepareContact);

  campaignQueue.process("DispatchCampaign", handleDispatchCampaign);

  userMonitor.process("VerifyLoginStatus", handleLoginStatus);

  queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);

  validateWhatsappContactsQueue.process("validateWhatsappContacts", async (job) => {
    const validateJob = await import("./jobs/validateWhatsappContactsQueue");
    return validateJob.default.handle(job);
  });

  scheduleMonitor.add(
    "Verify",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify" },
      removeOnComplete: true
    }
  );

  campaignQueue.add(
    "VerifyCampaignsDaatabase",
    {},
    {
      repeat: { cron: "*/20 * * * * *", key: "verify-campaing" },
      removeOnComplete: true
    }
  );

  userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "* * * * *", key: "verify-login" },
      removeOnComplete: true
    }
  );

  queueMonitor.add(
    "VerifyQueueStatus",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-queue" },
      removeOnComplete: true
    }
  );
}