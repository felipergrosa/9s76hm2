import BullQueue from "bull";
import { Op } from "sequelize";
import DripSequence from "../models/DripSequence";
import DripSequenceEnrollment from "../models/DripSequenceEnrollment";
import DripSequenceStep from "../models/DripSequenceStep";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import TicketTag from "../models/TicketTag";
import Ticket from "../models/Ticket";
import SendDripStepMessageService from "../services/DripSequenceService/SendDripStepMessageService";
import SendTemplateToContact from "../services/MetaServices/SendTemplateToContact";
import GetSessionWindow from "../services/MetaServices/GetSessionWindow";
import ExecuteFollowUpEndActionService from "../services/DripSequenceService/ExecuteFollowUpEndActionService";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const stepDelayMs = (step: DripSequenceStep): number =>
  (step.delayDays || 0) * MS_PER_DAY + (step.delayMinutes || 0) * MS_PER_MINUTE;

/**
 * Se a sequência tem janela de envio ("08:00"–"20:00"), reagenda o nextSendAt
 * que cair fora dela para o início da próxima janela.
 */
function clampToSendWindow(
  date: Date,
  windowStart?: string | null,
  windowEnd?: string | null
): Date {
  if (!windowStart || !windowEnd) return date;
  const [sh, sm] = windowStart.split(":").map(Number);
  const [eh, em] = windowEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return date;

  const start = new Date(date); start.setHours(sh, sm, 0, 0);
  const end = new Date(date); end.setHours(eh, em, 0, 0);

  if (date < start) return start;
  if (date > end) {
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    return next;
  }
  return date;
}

/**
 * Confirma que o gatilho da sequência ainda está aplicado ao contato:
 * - tag kanban (lane) → TicketTag em algum ticket do contato
 * - tag normal → ContactTag
 * Se a tag foi removida (bulk destroy não dispara hooks de modelo), o
 * enrollment é cancelado aqui — self-healing em vez de depender de hooks.
 */
async function isTriggerStillApplied(
  sequence: DripSequence,
  contactId: number
): Promise<boolean> {
  const tag = await Tag.findByPk(sequence.tagId, {
    attributes: ["id", "kanban"]
  });
  if (!tag) return false;

  if (Number(tag.kanban) === 1) {
    const laneTag = await TicketTag.findOne({
      where: { tagId: sequence.tagId },
      include: [
        {
          model: Ticket,
          attributes: ["id"],
          where: { contactId },
          required: true
        }
      ]
    });
    return Boolean(laneTag);
  }

  const contactTag = await ContactTag.findOne({
    where: { contactId, tagId: sequence.tagId }
  });
  return Boolean(contactTag);
}
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutos

// Gate da janela de 24h da API Oficial (Cloud API): mensagem livre de
// follow-up só pode sair dentro da janela aberta pela última mensagem do
// contato. Fora dela, o enrollment fica "waiting_window" e é reagendado —
// mesma regra da referência Fluxoo (steps seguintes só disparam após o
// contato responder). A coluna status é STRING livre → sem migration.
const ENROLLMENT_DISPATCHABLE_STATUSES = ["active", "waiting_window"];
const WINDOW_WAIT_RETRY_MS = 30 * 60 * 1000; // re-checa a janela a cada 30min
const WINDOW_WAIT_TTL_MS = 7 * MS_PER_DAY;   // janela não reabriu em 7d → cancela

export const dripSequenceQueue = new BullQueue("DripSequenceQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 }
  }
});

async function verifyDripEnrollments(): Promise<void> {
  const enrollments = await DripSequenceEnrollment.findAll({
    where: {
      status: { [Op.in]: ENROLLMENT_DISPATCHABLE_STATUSES },
      nextSendAt: { [Op.lte]: new Date() }
    }
  });

  for (const enrollment of enrollments) {
    await dripSequenceQueue.add("DispatchDripStep", { enrollmentId: enrollment.id });
  }
}

async function dispatchDripStep(job: any): Promise<void> {
  const { enrollmentId } = job.data;

  const enrollment = await DripSequenceEnrollment.findByPk(enrollmentId);
  if (!enrollment || !ENROLLMENT_DISPATCHABLE_STATUSES.includes(enrollment.status)) {
    return;
  }

  const steps = await DripSequenceStep.findAll({
    where: { dripSequenceId: enrollment.dripSequenceId },
    order: [["order", "ASC"]]
  });

  const currentStep = steps[enrollment.currentStepIndex];

  if (!currentStep) {
    await enrollment.update({ status: "completed" });
    return;
  }

  try {
    const [contact, dripSequence] = await Promise.all([
      Contact.findByPk(enrollment.contactId),
      DripSequence.findByPk(enrollment.dripSequenceId)
    ]);

    if (!contact) {
      await enrollment.update({ status: "cancelled", lastError: "Contato não encontrado" });
      return;
    }

    if (!dripSequence) {
      await enrollment.update({ status: "cancelled", lastError: "Sequência removida" });
      return;
    }

    // Self-healing: contato saiu da lane / perdeu a tag gatilho → cancela
    const stillApplied = await isTriggerStillApplied(dripSequence, contact.id);
    if (!stillApplied) {
      await enrollment.update({
        status: "cancelled",
        lastError: "Tag gatilho removida (contato saiu da lane)"
      });
      return;
    }

    const whatsapp = dripSequence?.whatsappId
      ? await Whatsapp.findByPk(dripSequence.whatsappId)
      : null;

    if (!whatsapp) {
      await enrollment.update({
        status: "failed",
        lastError: "Sequência sem conexão WhatsApp configurada",
        lastErrorAt: new Date()
      });
      return;
    }

    // Gate da janela de 24h (API Oficial): step de mensagem livre só envia
    // com a janela aberta. Step com template Meta ignora o gate — template
    // aprovado é justamente o envio permitido fora da janela.
    if (whatsapp.channelType === "official" && !currentStep.metaTemplateName) {
      const { hasOpenSession } = await GetSessionWindow({
        whatsappId: whatsapp.id,
        contactId: contact.id,
        companyId: enrollment.companyId
      });

      if (!hasOpenSession) {
        // lastErrorAt ancora o início da espera — TTL evita enrollment
        // preso para sempre se o contato nunca responder.
        const nowMs = Date.now();
        const waitingSince =
          enrollment.status === "waiting_window" && enrollment.lastErrorAt
            ? new Date(enrollment.lastErrorAt).getTime()
            : nowMs;

        if (nowMs - waitingSince >= WINDOW_WAIT_TTL_MS) {
          await enrollment.update({
            status: "cancelled",
            lastError:
              "Janela de 24h não reaberta — follow-up expirado aguardando resposta do contato",
            lastErrorAt: new Date()
          });
          return;
        }

        await enrollment.update({
          status: "waiting_window",
          lastError:
            "Aguardando janela de 24h da API Oficial (contato precisa responder ou o step precisa de template Meta)",
          lastErrorAt: new Date(waitingSince),
          nextSendAt: new Date(nowMs + WINDOW_WAIT_RETRY_MS)
        });
        return;
      }
    }

    // Step com template Meta: usado em conexão oficial (obrigatório fora da
    // janela de 24h) — mas também funciona para enviar template em Baileys?
    // Não: Baileys não suporta templates Meta. Se a conexão não for oficial,
    // cai no envio de texto livre (message do step).
    if (currentStep.metaTemplateName && whatsapp.channelType === "official") {
      let variablesConfig: Record<string, any> | undefined;
      if (currentStep.metaTemplateVariables) {
        try {
          variablesConfig = JSON.parse(currentStep.metaTemplateVariables);
        } catch {
          variablesConfig = undefined;
        }
      }
      await SendTemplateToContact({
        whatsappId: whatsapp.id,
        contactId: contact.id,
        companyId: enrollment.companyId,
        userId: null,
        templateName: currentStep.metaTemplateName,
        languageCode: currentStep.metaTemplateLanguage || "pt_BR",
        variablesConfig,
        statusTicket: "open"
      });
    } else {
      await SendDripStepMessageService(contact, whatsapp, enrollment.companyId, currentStep.message);
    }

    const nextIndex = enrollment.currentStepIndex + 1;
    const nextStep = steps[nextIndex];

    if (nextStep) {
      await enrollment.update({
        currentStepIndex: nextIndex,
        // Volta para "active" caso tenha enviado após período em waiting_window
        status: "active",
        nextSendAt: clampToSendWindow(
          new Date(Date.now() + stepDelayMs(nextStep)),
          dripSequence.sendWindowStart,
          dripSequence.sendWindowEnd
        ),
        attempts: 0,
        lastError: null
      });
    } else {
      await enrollment.update({ status: "completed", currentStepIndex: nextIndex });
      await ExecuteFollowUpEndActionService(dripSequence, contact);
    }
  } catch (error: any) {
    const attempts = (enrollment.attempts || 0) + 1;
    logger.error(`[DripSequenceQueue] Erro ao enviar etapa para enrollment ${enrollmentId}: ${error.message}`);

    if (attempts >= MAX_ATTEMPTS) {
      await enrollment.update({
        status: "failed",
        attempts,
        lastError: error.message,
        lastErrorAt: new Date()
      });
    } else {
      await enrollment.update({
        attempts,
        lastError: error.message,
        lastErrorAt: new Date(),
        nextSendAt: new Date(Date.now() + RETRY_DELAY_MS)
      });
    }
  }
}

/** Registra os processadores da fila — chamado uma vez em queues.ts:startQueueProcess() */
export function setupDripSequenceProcessors(): void {
  dripSequenceQueue.process("VerifyDripEnrollments", 1, verifyDripEnrollments);
  dripSequenceQueue.process("DispatchDripStep", 3, dispatchDripStep);

  logger.info("[DripSequenceQueue] Processadores configurados");
}

/** Agenda a verificação periódica de inscrições prontas para a próxima etapa */
export async function scheduleDripSequenceVerification(): Promise<void> {
  await dripSequenceQueue.add(
    "VerifyDripEnrollments",
    {},
    { repeat: { cron: "*/5 * * * *", key: "verify-drip-sequence" }, removeOnComplete: true }
  );
}

export default dripSequenceQueue;
