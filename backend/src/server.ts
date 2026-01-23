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
import startInactivityTimeoutJob from "./jobs/VerifyInactivityTimeoutJob";
import startWhatsAppHealthCheckJob from "./jobs/WhatsAppHealthCheckJob";

import { startQueueProcess } from "./queues";
import tagRulesCron from "./cron/tagRulesCron";
import tagRulesRecentContactsCron from "./cron/tagRulesRecentContactsCron";
import { checkOrphanedSessionsCron } from "./cron/checkOrphanedSessionsCron";

const ENV_PROFILE = process.env.APP_ENV || process.env.NODE_ENV || "development";
const isProduction = ENV_PROFILE === "production";
let queuesStarted = false;

const startQueuesWithFallback = async (origin = "startup") => {
  if (queuesStarted) {
    return;
  }

  try {
    await startQueueProcess();
    queuesStarted = true;
    logger.info(`Processamento de filas iniciado automaticamente (${origin}) | ambiente=${ENV_PROFILE}`);
  } catch (error: any) {
    logger.error(`Falha ao iniciar processamento de filas (${origin}) | ambiente=${ENV_PROFILE} | erro=${error?.message || error}`);
    setTimeout(() => {
      if (!queuesStarted) {
        startQueuesWithFallback("retry");
      }
    }, 15000);
  }
};
// import { ScheduledMessagesJob, ScheduleMessagesGenerateJob, ScheduleMessagesEnvioJob, ScheduleMessagesEnvioForaHorarioJob } from "./wbotScheduledMessages";

const port = Number(process.env.PORT) || 8080;
const server = app.listen(port, async () => {
  // Log de versão após inicialização do Sequelize (evita ModelNotInitializedError)
  (async () => {
    const safeRead = (p: string) => {
      try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; }
    };
    const safeExec = (cmd: string) => {
      try { return execSync(cmd).toString().trim(); } catch { return ""; }
    };
    const findGitDir = (): string => {
      // Procura pela pasta/arquivo .git subindo até 4 níveis a partir do CWD
      let dir = process.cwd();
      for (let i = 0; i < 4; i += 1) {
        const gitPath = path.join(dir, ".git");
        try {
          if (fs.existsSync(gitPath)) {
            try {
              const stat = fs.lstatSync(gitPath);
              if (stat.isDirectory()) {
                return gitPath; // .git é diretório
              }
              // .git é arquivo com ponteiro gitdir
              const content = fs.readFileSync(gitPath, "utf8");
              const m = content.match(/gitdir:\s*(.*)\s*/i);
              if (m && m[1]) {
                const gitDirPath = path.isAbsolute(m[1]) ? m[1] : path.resolve(dir, m[1]);
                if (fs.existsSync(gitDirPath)) return gitDirPath;
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return "";
    };
    const readCommitFromGitDir = (): string => {
      try {
        const gitDir = findGitDir();
        if (!gitDir) return "";
        const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
        if (head.startsWith("ref:")) {
          const ref = head.split(":")[1].trim();
          const refPath = path.join(gitDir, ref);
          if (fs.existsSync(refPath)) {
            const full = fs.readFileSync(refPath, "utf8").trim();
            return full.substring(0, 7);
          }
        } else if (/^[0-9a-f]{7,40}$/i.test(head)) {
          return head.substring(0, 7);
        }
      } catch { /* ignore */ }
      return "";
    };

    // Detecta versão do package.json (ou ENV) para manter produção e dev alinhados
    let pkgVersion = process.env.BACKEND_VERSION || "";
    if (!pkgVersion) {
      try {
        const pkgPath = path.join(process.cwd(), "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        pkgVersion = pkg?.version || "";
      } catch {
        pkgVersion = "";
      }
    }
    if (!pkgVersion) pkgVersion = "N/A";

    // Atualiza/sincroniza tabela Versions (id=1) com a versão atual do backend
    try {
      const existing = await Version.findByPk(1);
      if (existing) {
        if (existing.versionBackend !== pkgVersion) {
          await existing.update({ versionBackend: pkgVersion });
        }
      } else {
        await Version.create({ id: 1, versionBackend: pkgVersion, versionFrontend: existing?.versionFrontend || null as any });
      }
    } catch (e) {
      // Falha ao sincronizar versão no banco não impede startup
      // eslint-disable-next-line no-console
      console.warn("WARN: falha ao sincronizar Versions.versionBackend:", (e as any)?.message || e);
    }

    // Busca valor visível no log (mantém compatibilidade com getBackendVersion())
    const backendVersion = await getBackendVersion();

    // Calcula commit e data de build. Não dependa de git em runtime; suprime stderr.
    const fileCommit = safeRead(path.join(process.cwd(), ".git-commit"));
    const gitCommit = safeExec("git rev-parse --short HEAD") || readCommitFromGitDir();
    const commit = process.env.GIT_COMMIT || fileCommit || gitCommit || "N/A";
    const buildDate = process.env.BUILD_DATE || safeRead(path.join(process.cwd(), ".build-date")) || new Date().toISOString();

    // eslint-disable-next-line no-console
    console.log(`BACKEND BUILD: ${buildDate} | Commit: ${commit} | Version: ${backendVersion}`);
  })();
  const companies = await Company.findAll({
    where: { status: true },
    attributes: ["id"]
  });

  const allPromises: any[] = [];
  companies.forEach(c => {
    const promise = StartAllWhatsAppsSessions(c.id).catch(err => {
      logger.error(`Falha ao iniciar sessão WhatsApp da empresa ${c.id}: ${err?.message || err}`);
    });
    allPromises.push(promise);
  });

  Promise.all(allPromises)
    .then(() => startQueuesWithFallback("after-whatsapp-sessions"))
    .catch(err => {
      logger.error(`Erros ao iniciar sessões WhatsApp: ${err?.message || err}`);
      startQueuesWithFallback("after-whatsapp-sessions-error");
    })
    .finally(() => {
      if (!queuesStarted) {
        const delay = isProduction ? 5000 : 0;
        setTimeout(() => startQueuesWithFallback("finalizer"), delay);
      }
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

// Inicializa os crons de aplicação automática de tag rules
tagRulesCron(); // Executa diariamente às 2h (processamento completo)
tagRulesRecentContactsCron(); // Executa a cada 5 minutos (apenas contatos recentes)

// Inicializa job de verificação de inatividade de tickets
startInactivityTimeoutJob(); // Verifica a cada 1 minuto

// Inicializa job de health check das conexões WhatsApp
startWhatsAppHealthCheckJob(); // Verifica a cada 2 minutos e reconecta automaticamente

// Inicializa cron de verificação de sessões órfãs (HA para Replicas)
checkOrphanedSessionsCron();

initIO(server);
gracefulShutdown(server);
