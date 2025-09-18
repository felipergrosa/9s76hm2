/// <reference path="./@types/express.d.ts" />
import 'dotenv/config';
import gracefulShutdown from "http-graceful-shutdown";
import http from "http";

import Version from "./models/Versions";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const getBackendVersion = async () => {
  const version = await Version.findByPk(1);
  return version ? version.versionBackend : "N/A";
};


import app from "./app";
import sequelize from "./database";

// --- Endpoint de Healthcheck ---
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});
// --- Fim do Healthcheck ---

import { initIO } from "./libs/socket";
import logger from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import BullQueue from './libs/queue';
import { initSavedFilterCron } from "./jobs/SavedFilterCronManager";

import { startQueueProcess } from "./queues";
// import { ScheduledMessagesJob, ScheduleMessagesGenerateJob, ScheduleMessagesEnvioJob, ScheduleMessagesEnvioForaHorarioJob } from "./wbotScheduledMessages";

const port = Number(process.env.PORT) || 8080;
const server = app.listen(port, async () => {
  // Log de versão após inicialização do Sequelize (evita ModelNotInitializedError)
  getBackendVersion().then(backendVersion => {
    const safeRead = (p: string) => {
      try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; }
    };
    const safeExec = (cmd: string) => {
      try { return execSync(cmd).toString().trim(); } catch { return ""; }
    };
    const commit = process.env.GIT_COMMIT
      || safeRead(path.join(process.cwd(), ".git-commit"))
      || safeExec("git rev-parse --short HEAD")
      || "N/A";
    const buildDate = process.env.BUILD_DATE
      || safeRead(path.join(process.cwd(), ".build-date"))
      || new Date().toISOString();

    console.log(`BACKEND BUILD: ${buildDate} | Commit: ${commit} | Version: ${backendVersion}`);
  });
  const companies = await Company.findAll({
    where: { status: true },
    attributes: ["id"]
  });

  const allPromises: any[] = [];
  companies.map(async c => {
    const promise = StartAllWhatsAppsSessions(c.id);
    allPromises.push(promise);
  });

  Promise.all(allPromises).then(async () => {
    await startQueueProcess();
  });

  const hasRedisQueues = Boolean((process.env.REDIS_URI_ACK && process.env.REDIS_URI_ACK !== '') || (process.env.REDIS_URI && process.env.REDIS_URI !== ''));
  if (hasRedisQueues) {
    BullQueue.process();
  } else {
    logger.warn("BullQueue desabilitado: defina REDIS_URI ou REDIS_URI_ACK para habilitar processamento de filas.");
  }

  // Checagem da extensão pgvector
  try {
    const [rows] = await sequelize.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    const ok = Array.isArray(rows) && rows.length > 0;
    if (ok) {
      logger.info("pgvector: OK (extensão 'vector' instalada)");
    } else {
      logger.warn("pgvector: extensão 'vector' NÃO encontrada. Habilite com: CREATE EXTENSION IF NOT EXISTS vector;");
    }
  } catch (e: any) {
    logger.error(`pgvector: falha ao checar extensão: ${e?.message || e}`);
  }

  logger.info(`Server started on port: ${port}`);
});

process.on("uncaughtException", err => {
  console.error(`${new Date().toUTCString()} uncaughtException:`, err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason, p) => {
  console.error(
    `${new Date().toUTCString()} unhandledRejection:`,
    reason,
    p
  );
});

// Inicializa o cron de sincronização de savedFilter (configurável por env/Settings)
initSavedFilterCron();

initIO(server);
gracefulShutdown(server);
