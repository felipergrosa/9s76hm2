import 'dotenv/config';
import BullQueue from 'bull';
import { REDIS_URI_MSG_CONN } from "../config/redis";
import configLoader from '../services/ConfigLoaderService/configLoaderService';
import * as jobs from '../jobs';
import logger from '../utils/logger';

const config = configLoader(); // Carregue as configurações

const queueOptions = {
  defaultJobOptions: {
    attempts: config.webhook.attempts,
    backoff: {
      type: config.webhook.backoff.type,
      delay: config.webhook.backoff.delay,
    },
    removeOnFail: false,
    removeOnComplete: true,
    // Timeout de 30 segundos por job (evita jobs infinitos)
    timeout: parseInt(process.env.BULL_JOB_TIMEOUT_MS || "30000"),
  },
  limiter: {
    max: config.webhook.limiter.max,
    duration: config.webhook.limiter.duration,
  },
  // Configurações para detectar jobs stalled
  settings: {
    // Intervalo para verificar jobs stalled (15 segundos)
    stalledInterval: parseInt(process.env.BULL_STALLED_INTERVAL_MS || "15000"),
    // Máximo de vezes que um job pode ser marcado como stalled antes de falhar
    maxStalledCount: parseInt(process.env.BULL_MAX_STALLED_COUNT || "3"),
    // Tempo máximo para um job completar antes de ser considerado stalled
    stallDuration: parseInt(process.env.BULL_STALL_DURATION_MS || "30000"),
  },
};

const queues = Object.values(jobs).reduce((acc, job) => {
  acc.push({
    bull: new BullQueue(job.key, REDIS_URI_MSG_CONN, queueOptions),
    name: job.key,
    handle: job.handle,
  });
  return acc;
}, []);

export default {
  queues,
  add(name: string, data, params = {}) {
    const queue = this.queues.find(queue => queue.name === name);

    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }

    return queue.bull.add(data, { ...params, removeOnComplete: true });
  },
  process() {
    return this.queues.forEach(queue => {
      // CRÍTICO: concurrency=5 para processar múltiplas mensagens em paralelo
      // Cada mensagem usa lock por JID (wbotMessageListener) para evitar race conditions
      // sem bloquear mensagens de contatos diferentes
      queue.bull.process(5, queue.handle);

      queue.bull.on('failed', (job, err) => {
        logger.error(
          {
            queueName: queue.name,
            jobId: job?.id,
            data: job?.data,
            error: err?.message || err,
            stack: err?.stack
          },
          "[BullQueue] Job failed"
        );
      });
    })
  }
}
