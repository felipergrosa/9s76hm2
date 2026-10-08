import * as Sentry from "@sentry/node";
import { Op, Sequelize } from "sequelize";

import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessageUnified from "../WbotServices/SendWhatsAppMessageUnified";
import { isRealPhoneNumber } from "../../utils/phone";
import logger from "../../utils/logger";

/**
 * Config. Aniversário (referência Fluxoo)
 * ---------------------------------------
 * Job diário (ver handleBirthdayGreetings em queues.ts) que envia mensagem de
 * parabéns via WhatsApp para contatos cujo Contacts.birthdate cai no dia de hoje.
 *
 * Configuração por empresa (CompaniesSettings):
 * - birthdayMessageEnabled: "enabled" | "disabled"
 * - birthdayMessage: template com variáveis ({name}, {firstName}, {ms} ...)
 * - birthdayWhatsappId: Whatsapp.id da conexão de envio (vazio = padrão)
 *
 * Dedupe: Contacts.lastBirthdayGreetingAt (DATEONLY no fuso do job) impede
 * reenvio se o job executar mais de uma vez no mesmo dia.
 */

// Mesmo fuso dos demais crons registrados em queues.ts
const BIRTHDAY_TZ = "America/Sao_Paulo";

// Intervalo mínimo entre envios na mesma conexão — evita rajada de mensagens
const SEND_INTERVAL_MS = 1500;

// "Hoje" no fuso do job em partes numéricas (seguras para interpolar em literal SQL)
const todayInJobTz = (): { today: string; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BIRTHDAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  const year = get("year");
  const month = get("month");
  const day = get("day");

  return {
    today: `${year}-${month}-${day}`,
    month: Number(month),
    day: Number(day)
  };
};

// Aceita variáveis com chave simples ({name}) além das de chave dupla ({{name}}).
// O Mustache usado no formatBody só renderiza {{var}} — aqui normalizamos antes.
// A regex ignora {{var}}: exige que o "{" não venha logo após outro "{" e que o
// "}" não seja seguido de outro "}".
const normalizeTemplateVars = (template: string): string =>
  template.replace(/(^|[^{])\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/g, "$1{{$2}}");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Resolve a conexão de envio: birthdayWhatsappId se configurada e CONNECTED;
// senão cai para a conexão padrão da empresa (GetDefaultWhatsApp filtra
// canal whatsapp + status CONNECTED).
const resolveWhatsapp = async (
  settings: CompaniesSettings
): Promise<Whatsapp | null> => {
  const companyId = settings.companyId;
  const configuredId = Number(settings.birthdayWhatsappId);

  if (configuredId) {
    const configured = await Whatsapp.findOne({
      where: { id: configuredId, companyId }
    });

    if (!configured) {
      logger.warn(
        `[BirthdayGreeting] Empresa ${companyId}: conexão configurada ${configuredId} não encontrada. Usando conexão padrão.`
      );
    } else if (configured.status !== "CONNECTED") {
      logger.warn(
        `[BirthdayGreeting] Empresa ${companyId}: conexão "${configured.name}" (${configuredId}) está ${configured.status}. Usando conexão padrão.`
      );
    } else {
      return configured;
    }
  }

  try {
    return await GetDefaultWhatsApp(undefined, companyId);
  } catch {
    return null;
  }
};

const SendBirthdayGreetingsService = async (): Promise<{
  companies: number;
  sent: number;
  skipped: number;
  errors: number;
}> => {
  const { today, month, day } = todayInJobTz();
  const stats = { companies: 0, sent: 0, skipped: 0, errors: 0 };

  // Apenas empresas com a feature ativa E mensagem configurada
  const allSettings = await CompaniesSettings.findAll({
    where: {
      birthdayMessageEnabled: "enabled",
      [Op.and]: [
        { birthdayMessage: { [Op.ne]: null } },
        { birthdayMessage: { [Op.ne]: "" } }
      ]
    }
  });

  for (const settings of allSettings) {
    const companyId = settings.companyId;
    stats.companies += 1;

    try {
      const whatsapp = await resolveWhatsapp(settings);
      if (!whatsapp) {
        logger.warn(
          `[BirthdayGreeting] Empresa ${companyId}: nenhuma conexão WhatsApp conectada. Pulando empresa.`
        );
        continue;
      }

      // Aniversariantes do dia que ainda não receberam parabéns nesta data.
      // month/day/today vêm de Intl.DateTimeFormat (apenas dígitos) — seguros
      // para interpolar em literal. Isolamento por companyId garantido no where.
      const contacts = await Contact.findAll({
        where: {
          companyId,
          isGroup: false,
          birthdate: { [Op.ne]: null },
          [Op.and]: [
            Sequelize.literal(`EXTRACT(MONTH FROM "birthdate") = ${month}`),
            Sequelize.literal(`EXTRACT(DAY FROM "birthdate") = ${day}`),
            Sequelize.literal(
              `("lastBirthdayGreetingAt" IS NULL OR "lastBirthdayGreetingAt" <> '${today}')`
            )
          ]
        },
        attributes: [
          "id",
          "name",
          "number",
          "companyId",
          "isGroup",
          "remoteJid",
          "lidJid",
          "birthdate",
          "lastBirthdayGreetingAt"
        ]
      });

      if (contacts.length === 0) continue;

      logger.info(
        `[BirthdayGreeting] Empresa ${companyId}: ${contacts.length} aniversariante(s) em ${today} via conexão "${whatsapp.name}" (${whatsapp.id}).`
      );

      for (const contact of contacts) {
        try {
          // Contatos só-LID sem número real são pulados: ResolveSendJid
          // (dentro do envio unificado) falharia com AppError de qualquer forma,
          // mas evitamos criar ticket à toa.
          if (!isRealPhoneNumber(contact.number) && !contact.lidJid) {
            stats.skipped += 1;
            logger.warn(
              `[BirthdayGreeting] Contato ${contact.id} sem número válido nem LID resolvível — pulando.`
            );
            continue;
          }

          // Reusa ticket ainda não fechado do contato nesta conexão (a mensagem
          // entra na conversa em andamento). Se não houver, cria ciclo novo com
          // isCampaign — depois força status "campaign" para não cair na fila
          // de pendentes nem disparar bot (mesmo padrão do disparo de campanhas).
          let ticket = await Ticket.findOne({
            where: {
              contactId: contact.id,
              companyId,
              whatsappId: whatsapp.id,
              isGroup: false,
              status: { [Op.ne]: "closed" }
            },
            order: [["id", "DESC"]]
          });

          if (!ticket) {
            ticket = await FindOrCreateTicketService(
              contact,
              whatsapp,
              0, // unreadMessages
              companyId,
              null, // queueId
              null, // userId
              null, // groupContact
              "whatsapp", // channel
              false, // isImported
              false, // isForward
              settings,
              false, // isTransfered
              true // isCampaign
            );

            if (["pending", "bot", "lgpd"].includes(ticket.status)) {
              await ticket.update({ status: "campaign" });
            }
          }

          // Reload com includes (contact/whatsapp/queue) — o formatBody/Mustache
          // do envio unificado resolve {name}, {firstName} etc. via ticket.contact
          ticket = await ShowTicketService(ticket.id, companyId);

          const body = normalizeTemplateVars(settings.birthdayMessage || "");
          await SendWhatsAppMessageUnified({ body, ticket });

          // Dedupe: marca somente após envio bem-sucedido — falha permite
          // nova tentativa na próxima execução do job.
          await contact.update({ lastBirthdayGreetingAt: today });
          stats.sent += 1;

          await sleep(SEND_INTERVAL_MS);
        } catch (e: any) {
          // Um contato com erro nunca derruba o job nem os demais envios
          stats.errors += 1;
          logger.error(
            `[BirthdayGreeting] Falha ao enviar para contato ${contact.id} (empresa ${companyId}): ${e?.message}`
          );
          Sentry.captureException(e);
        }
      }
    } catch (e: any) {
      // Uma empresa com erro nunca derruba as demais
      stats.errors += 1;
      logger.error(
        `[BirthdayGreeting] Falha ao processar empresa ${companyId}: ${e?.message}`
      );
      Sentry.captureException(e);
    }
  }

  return stats;
};

export default SendBirthdayGreetingsService;
