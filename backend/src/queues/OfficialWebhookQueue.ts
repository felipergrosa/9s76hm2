import crypto from "crypto";
import BullQueue from "bull";
import logger from "../utils/logger";
import ProcessWhatsAppWebhook from "../services/WbotServices/ProcessWhatsAppWebhook";

interface OfficialWebhookJob {
  change: any;
  phoneNumberId: string;
}

const queue = new BullQueue<OfficialWebhookJob>(
  `${process.env.DB_NAME || "whaticket"}-OfficialWebhookInbound`,
  process.env.REDIS_URI || "",
  {
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 50000 },
      removeOnFail: false
    }
  }
);

let started = false;

export function startOfficialWebhookQueue(): void {
  if (started) return;
  queue.process(5, async job => {
    if (job.data.change?.value?.metadata?.phone_number_id !== job.data.phoneNumberId) {
      throw new Error("Official webhook phone number changed after enqueue");
    }
    await ProcessWhatsAppWebhook(job.data.change);
  });
  queue.on("failed", (job, error) => {
    logger.error(`[OfficialWebhookQueue] Falha no job ${job?.id}: ${error.message}`);
  });
  started = true;
}

export async function enqueueOfficialWebhookChange(
  change: any,
  phoneNumberId: string
): Promise<void> {
  const digest = crypto.createHash("sha256")
    .update(JSON.stringify({ phoneNumberId, change }))
    .digest("hex");
  await queue.add({ change, phoneNumberId }, { jobId: `official-${digest}` });
}
