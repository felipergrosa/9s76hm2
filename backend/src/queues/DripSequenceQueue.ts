import BullQueue from "bull";
import { Op } from "sequelize";
import DripSequence from "../models/DripSequence";
import DripSequenceEnrollment from "../models/DripSequenceEnrollment";
import DripSequenceStep from "../models/DripSequenceStep";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import SendDripStepMessageService from "../services/DripSequenceService/SendDripStepMessageService";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
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

    await SendDripStepMessageService(contact, whatsapp, enrollment.companyId, currentStep.message);

    const nextIndex = enrollment.currentStepIndex + 1;
    const nextStep = steps[nextIndex];

    if (nextStep) {
      await enrollment.update({
        currentStepIndex: nextIndex,
        nextSendAt: new Date(Date.now() + nextStep.delayDays * MS_PER_DAY),
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
