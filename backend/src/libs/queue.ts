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
  },
  limiter: {
    max: config.webhook.limiter.max,
    duration: config.webhook.limiter.duration,
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
      queue.bull.process(queue.handle);

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
