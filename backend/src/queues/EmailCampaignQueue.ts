import BullQueue from "bull";
import { Op } from "sequelize";
import EmailCampaign from "../models/EmailCampaign";
import EmailShipping from "../models/EmailShipping";
import ContactListItem from "../models/ContactListItem";
import { SendMail } from "../helpers/SendMail";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";

/**
 * Fila de disparo de campanhas de e-mail.
 * Clona o padrão de jobs/cron já usado para campanhas de WhatsApp em `queues.ts`
 * (verificação periódica de campanhas programadas + dispatch individual),
 * sem reaproveitar a fila do WhatsApp — fila própria, não interfere no disparo existente.
 */
export const emailCampaignQueue = new BullQueue("EmailCampaignQueue", connection, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 }
  }
});

interface ProcessEmailCampaignJob {
  emailCampaignId: number;
}

interface DispatchEmailJob {
  emailShippingId: number;
}

function renderTemplate(body: string, contact: ContactListItem): string {
  return (body || "")
    .replace(/\{name\}/gi, contact.name || "")
    .replace(/\{email\}/gi, contact.email || "");
}

async function verifyEmailCampaigns(): Promise<void> {
  const campaigns = await EmailCampaign.findAll({
    where: {
      status: "PROGRAMADA",
      scheduledAt: { [Op.lte]: new Date() }
    },
    attributes: ["id"]
  });

  for (const campaign of campaigns) {
    await campaign.update({ status: "EM_ANDAMENTO" });
    await emailCampaignQueue.add(
      "ProcessEmailCampaign",
      { emailCampaignId: campaign.id } as ProcessEmailCampaignJob
    );
    logger.info(`[EmailCampaignQueue] Campanha de e-mail ${campaign.id} enviada para processamento`);
  }
}

async function processEmailCampaign(job: any): Promise<void> {
  const { emailCampaignId }: ProcessEmailCampaignJob = job.data;

  const campaign = await EmailCampaign.findByPk(emailCampaignId);
  if (!campaign || !["EM_ANDAMENTO", "PROGRAMADA"].includes(campaign.status)) {
    logger.warn(`[EmailCampaignQueue] Campanha ${emailCampaignId} não encontrada ou não está ativa`);
    return;
  }

  if (!campaign.contactListId) {
    logger.warn(`[EmailCampaignQueue] Campanha ${emailCampaignId} não tem lista de contatos configurada`);
    await campaign.update({ status: "FINALIZADA", completedAt: new Date() });
    return;
  }

  const contacts = await ContactListItem.findAll({
    where: {
      contactListId: campaign.contactListId,
      email: { [Op.ne]: null }
    }
  });

  const validContacts = contacts.filter(c => !!c.email && c.email.includes("@"));

  if (validContacts.length === 0) {
    logger.warn(`[EmailCampaignQueue] Campanha ${emailCampaignId} não tem contatos com e-mail válido`);
    await campaign.update({ status: "FINALIZADA", completedAt: new Date() });
    return;
  }

  const shippings = await EmailShipping.bulkCreate(
    validContacts.map(contact => ({
      email: contact.email,
      subject: renderTemplate(campaign.subject, contact),
      message: renderTemplate(campaign.message, contact),
      contactId: contact.id,
      emailCampaignId: campaign.id,
      status: "pending"
    })) as any
  );

  const baseDelay = 2000; // 2s entre e-mails
  const jobs = shippings.map((shipping, index) => ({
    name: "DispatchEmail",
    data: { emailShippingId: shipping.id } as DispatchEmailJob,
    opts: { delay: baseDelay * index }
  }));

  await emailCampaignQueue.addBulk(jobs);

  logger.info(`[EmailCampaignQueue] Campanha ${emailCampaignId}: ${jobs.length} e-mails agendados`);
}

async function dispatchEmail(job: any): Promise<void> {
  const { emailShippingId }: DispatchEmailJob = job.data;

  const shipping = await EmailShipping.findByPk(emailShippingId);

  if (!shipping) {
    logger.warn(`[EmailCampaignQueue] EmailShipping ${emailShippingId} não encontrado`);
    return;
  }

  let thrownError: any = null;

  try {
    await shipping.update({ status: "processing" });

    await SendMail({
      to: shipping.email,
      subject: shipping.subject,
      html: shipping.message,
      text: shipping.message
    });

    await shipping.update({ status: "delivered", deliveredAt: new Date() });
  } catch (error: any) {
    thrownError = error;
    logger.error(`[EmailCampaignQueue] Erro ao enviar e-mail para ${shipping.email}: ${error.message}`);

    // Só marca como "failed" (terminal) na última tentativa do Bull — enquanto ainda
    // houver retry pendente, mantém "pending" para não contar como concluído abaixo.
    const maxAttempts = job.opts?.attempts || 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

    await shipping.update({
      status: isLastAttempt ? "failed" : "pending",
      attempts: (shipping.attempts || 0) + 1,
      lastError: error.message,
      lastErrorAt: new Date()
    });
  }

  // Roda sempre (sucesso ou falha definitiva) para a campanha não ficar
  // travada em EM_ANDAMENTO quando o último e-mail falha.
  const remaining = await EmailShipping.count({
    where: {
      emailCampaignId: shipping.emailCampaignId,
      status: { [Op.in]: ["pending", "processing"] }
    }
  });

  if (remaining === 0) {
    await EmailCampaign.update(
      { status: "FINALIZADA", completedAt: new Date() },
      { where: { id: shipping.emailCampaignId } }
    );
  }

  if (thrownError) {
    throw thrownError;
  }
}

/** Registra os processadores da fila — chamado uma vez em queues.ts:startQueueProcess() */
export function setupEmailCampaignProcessors(): void {
  emailCampaignQueue.process("VerifyEmailCampaigns", 1, verifyEmailCampaigns);
  emailCampaignQueue.process("ProcessEmailCampaign", 1, processEmailCampaign);
  emailCampaignQueue.process("DispatchEmail", 5, dispatchEmail);

  logger.info("[EmailCampaignQueue] Processadores configurados");
}

/** Agenda a verificação periódica de campanhas programadas — chamado uma vez em queues.ts:startQueueProcess() */
export async function scheduleEmailCampaignVerification(): Promise<void> {
  await emailCampaignQueue.add(
    "VerifyEmailCampaigns",
    {},
    { repeat: { cron: "*/20 * * * * *", key: "verify-email-campaign" }, removeOnComplete: true }
  );
}

/** Dispara o processamento imediato de uma campanha (botão "Enviar agora") */
export async function startEmailCampaignNow(emailCampaignId: number): Promise<void> {
  await EmailCampaign.update(
    { status: "EM_ANDAMENTO" },
    { where: { id: emailCampaignId } }
  );
  await emailCampaignQueue.add(
    "ProcessEmailCampaign",
    { emailCampaignId } as ProcessEmailCampaignJob
  );
}

export default emailCampaignQueue;
