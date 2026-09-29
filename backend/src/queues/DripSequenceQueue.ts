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
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const stepDelayMs = (step: DripSequenceStep): number =>
  (step.delayDays || 0) * MS_PER_DAY + (step.delayMinutes || 0) * MS_PER_MINUTE;

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

export const dripSequenceQueue = new BullQueue("DripSequenceQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 }
  }
});

async function verifyDripEnrollments(): Promise<void> {
  const enrollments = await DripSequenceEnrollment.findAll({
    where: {
      status: "active",
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
  if (!enrollment || enrollment.status !== "active") {
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
        nextSendAt: new Date(Date.now() + stepDelayMs(nextStep)),
        attempts: 0,
        lastError: null
      });
    } else {
      await enrollment.update({ status: "completed", currentStepIndex: nextIndex });
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
