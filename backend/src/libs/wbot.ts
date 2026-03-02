import * as Sentry from "@sentry/node";
import makeWASocket, {
  AuthenticationState,
  Browsers,
  DisconnectReason,
  WAMessage,
  WAMessageKey,
  WASocket,
  fetchLatestWaWebVersion,
  isJidBroadcast,
  isJidGroup,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { FindOptions } from "sequelize/types";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import pino from "pino";
import { useMultiFileAuthState } from "../helpers/useMultiFileAuthState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { StartWhatsAppSessionUnified as StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSessionUnified";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "./cache";
import ImportWhatsAppMessageService from "../services/WhatsappService/ImportWhatsAppMessageService";
import { add } from "date-fns";
import moment from "moment";
import { getTypeMessage, isValidMsg } from "../services/WbotServices/wbotMessageListener";
import { addLogs } from "../helpers/addLogs";
import NodeCache from 'node-cache';
import { Store } from "./store";
import fs from "fs";
import path from "path";
import createOrUpdateBaileysService from "../services/BaileysServices/CreateOrUpdateBaileysService";
import { releaseLeadership } from "./wbotLeaderService";
import { handleMessagingHistorySet } from "./messageHistoryHandler";
import SignalErrorHandler from "../services/WbotServices/SignalErrorHandler";
import SignalCleanupService from "../services/WbotServices/SignalCleanupService";

const msgRetryCounterCache = new NodeCache({
  stdTTL: 600,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});
const msgCache = new NodeCache({
  stdTTL: 60,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});

const loggerBaileys = pino({
  level: "error",
  hooks: {
    logMethod(args: any[], method: (...a: any[]) => void) {
      const isDecryptError = args.some(arg => {
        if (!arg) return false;

        const msg = typeof arg === "string" ? arg : String(arg?.msg || "");
        const errMsg =
          typeof arg === "object"
            ? String(arg?.err?.message || "") + " " + String(arg?.err?.stack || "")
            : "";

        const combined = (msg + " " + errMsg).toLowerCase();
        return (
          combined.includes("failed to decrypt message") ||
          combined.includes("bad mac") ||
          combined.includes("no matching sessions") ||
          combined.includes("no session found")
        );
      });

      if (isDecryptError) {
        // Rastrear erros de decriptação para auto-recovery
        for (const s of sessions) {
          if (s.id) {
            SignalErrorHandler.trackDecryptError(s.id);
          }
        }
        return; // Suprimir do log (já rastreado pelo handler)
      }
      return method.apply(this, args as any);
    }
  }
});

type Session = WASocket & {
  id?: number;
  store?: Store;
};

const sessions: Session[] = [];

const retriesQrCodeMap = new Map<number, number>();

// ========== CONTROLE DE RECONEXÃO (evita loops e race conditions) ==========
// Map para rastrear quais whatsappIds estão no processo de reconexão
const reconnectingWhatsapps = new Map<number, boolean>();

// Helper para expor estado de reconexão para outros módulos (ex: HealthCheck)
export const getWbotIsReconnecting = (whatsappId: number): boolean => {
  return !!reconnectingWhatsapps.get(whatsappId);
};

// Map para contar conflitos consecutivos (para backoff exponencial)
const conflictCountMap = new Map<number, number>();
// Constantes de tempo para reconexão
const BASE_CONFLICT_DELAY = 30_000; // 30 segundos base
const MAX_CONFLICT_DELAY = 120_000; // 2 minutos máximo
// ===========================================================================

export default function msg() {
  return {
    get: (key: WAMessageKey) => {
      const { id } = key;
      if (!id) return;
      let data = msgCache.get(id);
      if (data) {
        try {
          let msg = JSON.parse(data as string);
          return msg?.message;
        } catch (error) {
          logger.error(error);
        }
      }
    },
    save: (msg: WAMessage) => {
      const { id } = msg.key;
      const msgtxt = JSON.stringify(msg);
      try {
        msgCache.set(id as string, msgtxt);
      } catch (error) {
        logger.error(error);
      }
    }
  }
}

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    const availableSessions = sessions.map(s => s.id);
    const isReconnecting = reconnectingWhatsapps.get(whatsappId);
    
    logger.error(`[getWbot] Sessão NÃO encontrada para whatsappId=${whatsappId}. ` +
      `Disponíveis: [${availableSessions.join(", ")}]. ` +
      `Status Reconexão: ${isReconnecting ? "EM ANDAMENTO" : "PARADO"}. ` +
      `Process ID: ${process.pid}`);
    
    // AUTO-RECOVERY: Se não está reconectando, disparar recovery em background
    // Isso permite que a próxima chamada encontre a sessão
    if (!isReconnecting) {
      logger.warn(`[getWbot] Disparando AUTO-RECOVERY para whatsappId=${whatsappId}`);
      triggerSessionRecovery(whatsappId).catch(err => {
        logger.error(`[getWbot] Erro no auto-recovery: ${err?.message}`);
      });
    }
    
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

/**
 * Versão assíncrona do getWbot que aguarda a sessão estar disponível.
 * Se a sessão não existe, dispara recovery e aguarda até 30s.
 * Retorna null se não conseguir recuperar.
 */
export const getWbotOrRecover = async (
  whatsappId: number,
  maxWaitMs: number = 30000
): Promise<Session | null> => {
  // Se já existe, retornar imediatamente
  const existingIndex = sessions.findIndex(s => s.id === whatsappId);
  if (existingIndex !== -1) {
    return sessions[existingIndex];
  }

  const isReconnecting = reconnectingWhatsapps.get(whatsappId);
  
  logger.info(`[getWbotOrRecover] Sessão ${whatsappId} não encontrada. ` +
    `Reconectando: ${isReconnecting ? "SIM" : "NÃO"}. Aguardando até ${maxWaitMs}ms.`);

  // Se não está reconectando, disparar recovery
  if (!isReconnecting) {
    await triggerSessionRecovery(whatsappId);
  }

  // Aguardar a sessão ficar disponível
  const startTime = Date.now();
  const checkInterval = 1000; // 1s
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    
    if (sessionIndex !== -1) {
      logger.info(`[getWbotOrRecover] Sessão ${whatsappId} recuperada após ${attempts} tentativas ` +
        `(${Date.now() - startTime}ms)`);
      return sessions[sessionIndex];
    }

    // Aguardar antes de checar novamente
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  logger.error(`[getWbotOrRecover] Timeout aguardando sessão ${whatsappId} após ${attempts} tentativas`);
  return null;
};

/**
 * Dispara o processo de recovery de uma sessão.
 * Busca o WhatsApp no banco e inicia a sessão.
 */
const triggerSessionRecovery = async (whatsappId: number): Promise<void> => {
  try {
    // Marcar como reconectando ANTES de iniciar
    if (reconnectingWhatsapps.get(whatsappId)) {
      logger.debug(`[triggerSessionRecovery] ${whatsappId} já está em processo de reconexão`);
      return;
    }
    
    reconnectingWhatsapps.set(whatsappId, true);
    
    // Buscar WhatsApp no banco
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[triggerSessionRecovery] WhatsApp ${whatsappId} não encontrado no banco`);
      reconnectingWhatsapps.delete(whatsappId);
      return;
    }

    // Verificar se deve estar conectado
    if (whatsapp.status === "DISCONNECTED" || whatsapp.channel !== "whatsapp") {
      logger.info(`[triggerSessionRecovery] WhatsApp ${whatsappId} status=${whatsapp.status}, channel=${whatsapp.channel}. Não recuperando.`);
      reconnectingWhatsapps.delete(whatsappId);
      return;
    }

    logger.info(`[triggerSessionRecovery] Iniciando sessão ${whatsappId} (${whatsapp.name})`);
    
    // Importar dinamicamente para evitar dependência circular
    const { StartWhatsAppSession } = await import("../services/WbotServices/StartWhatsAppSessionUnified");
    await StartWhatsAppSession(whatsapp, whatsapp.companyId);
    
    // NOTA: A flag reconnectingWhatsapps será limpa quando connection === "open"
  } catch (err: any) {
    logger.error(`[triggerSessionRecovery] Erro ao recuperar sessão ${whatsappId}: ${err?.message}`);
    // Limpar flag em caso de erro
    reconnectingWhatsapps.delete(whatsappId);
  }
};

export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const options: FindOptions = {
      where: {
        companyId,
      },
      attributes: ["id"],
    };

    const whatsapp = await Whatsapp.findAll(options);

    whatsapp.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].ws.close(); // Remove the `undefined` argument
      }
    });
  } catch (err) {
    logger.error(err);
  }
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      if (isLogout) {
        sessions[sessionIndex].logout();
        sessions[sessionIndex].ws.close();
      }

      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

export var dataMessages: any = {};

export const msgDB = msg();


const sessionTokens = new Map<number, string>();

import { acquireWbotLock, renewWbotLock, releaseWbotLock, checkWbotLock } from "./wbotMutex";
import * as crypto from "crypto";

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Lock já adquirido pelo StartWhatsAppSessionUnified.ts
      // Apenas inicializar o socket aqui.

      // declarando wsocket fora do setInterval para ser acessvel
      let wsocket: Session = null;

      // Token de geração para garantir que apenas a sessão mais recente neste processo controle a reconexão
      const mySessionToken = crypto.randomUUID();
      sessionTokens.set(whatsapp.id, mySessionToken);

      (async () => {
        let io: any;
        try {
          io = getIO();
        } catch (e) {
          logger.warn("[wbot] Socket.io não inicializado (possível script CLI). Ignorando emissão de eventos.");
        }
        // ... (omitted lines) ...
        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) {
          return resolve(null as any);
        }

        const { id, name, allowGroup, companyId } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestWaWebVersion({});
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const baileysPkg = require("@whiskeysockets/baileys/package.json");
          const ts = moment().format("DD-MM-YYYY HH:mm:ss");
          logger.info(`Baileys pkg v${baileysPkg?.version || "unknown"} | WA Web v${version.join(".")}, isLatest: ${isLatest}`);
        } catch (e) {
          const ts = moment().format("DD-MM-YYYY HH:mm:ss");
          logger.info(`Baileys pkg vunknown | WA Web v${version.join(".")}, isLatest: ${isLatest}`);
        }
        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        const { state, saveCreds } = await useMultiFileAuthState(whatsapp, () => {
          if (wsocket) {
            logger.error(`[wbot] Zombie detected via Write Fencing. Killing connection for ${name}.`);
            try {
              wsocket.ws.close();
              wsocket.end(new Error("Zombie Fencing - Lock Lost during write"));
            } catch (e) {
              logger.error(`[wbot] Error killing zombie connection: ${e}`);
            }
          }
        });

        wsocket = makeWASocket({
          version,
          logger: loggerBaileys,
          printQRInTerminal: false,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
          },
          generateHighQualityLinkPreview: true,
          linkPreviewImageThumbnailWidth: 192,
          shouldIgnoreJid: (jid) => {
            return isJidBroadcast(jid) || (!allowGroup && isJidGroup(jid))
          },
          browser: ["Whaticket " + (process.env.NODE_ENV === "production" ? "PROD" : "DEV"), "Chrome", "10.0"],
          defaultQueryTimeoutMs: undefined,
          msgRetryCounterCache,
          markOnlineOnConnect: false,
          retryRequestDelayMs: 500,
          maxMsgRetryCount: 5,
          emitOwnEvents: true,
          fireInitQueries: true,
          transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
          connectTimeoutMs: 25_000,
          keepAliveIntervalMs: 30_000,
          getMessage: msgDB.get,
          syncFullHistory: !!whatsapp.importOldMessages,
        });

        wsocket.ev.on("connection.update", async (update) => {
          const { connection } = update;
          if (connection === 'close') {
            // Heartbeat cleanup managed externally
          }
        });

        setTimeout(async () => {
          const wpp = await Whatsapp.findByPk(whatsapp.id);
          if (wpp?.importOldMessages && wpp.status === "CONNECTED") {
            let dateOldLimit = new Date(wpp.importOldMessages).getTime();
            let dateRecentLimit = new Date(wpp.importRecentMessages).getTime();

            addLogs({
              fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`, forceNewFile: true,
              text: `Aguardando conexão para iniciar a importação de mensagens:
  Whatsapp nome: ${wpp.name}
  Whatsapp Id: ${wpp.id}
  Criação do arquivo de logs: ${moment().format("DD/MM/YYYY HH:mm:ss")}
  Selecionado Data de inicio de importação: ${moment(dateOldLimit).format("DD/MM/YYYY HH:mm:ss")} 
  Selecionado Data final da importação: ${moment(dateRecentLimit).format("DD/MM/YYYY HH:mm:ss")} 
  `})
            const statusImportMessages = new Date().getTime();
            await wpp.update({ statusImportMessages });

            wsocket.ev.on("messaging-history.set", async (messageSet: any) => {
              logger.info(`[Import] messaging-history.set recebido para whatsappId=${whatsapp.id}`);
              const statusImportMessages = new Date().getTime();
              await wpp.update({ statusImportMessages });

              try {
                const { contacts: snapContacts, chats: snapChats } = messageSet || {};
                if ((Array.isArray(snapContacts) && snapContacts.length) || (Array.isArray(snapChats) && snapChats.length)) {
                  await createOrUpdateBaileysService({
                    whatsappId: whatsapp.id,
                    contacts: Array.isArray(snapContacts) ? snapContacts : undefined,
                    chats: Array.isArray(snapChats) ? snapChats : undefined
                  });
                  logger.info(`[wbot] snapshot persisted`);
                }
              } catch (e: any) {
                logger.warn(`[wbot] snapshot persist failed: ${e?.message}`);
              }

              const whatsappId = whatsapp.id;
              let filteredMessages = messageSet.messages;
              let filteredDateMessages = [];
              filteredMessages.forEach(msg => {
                const timestampMsg = Math.floor(msg.messageTimestamp["low"] * 1000);
                if (isValidMsg(msg) && dateOldLimit < timestampMsg && dateRecentLimit > timestampMsg) {
                  filteredDateMessages.push(msg);
                }
              });

              if (!dataMessages?.[whatsappId]) {
                dataMessages[whatsappId] = [];
                dataMessages[whatsappId].unshift(...filteredDateMessages);
              } else {
                dataMessages[whatsappId].unshift(...filteredDateMessages);
              }

              setTimeout(async () => {
                const wpp = await Whatsapp.findByPk(whatsappId);
                io?.of(`/workspace-${companyId}`).emit(`importMessages-${wpp.companyId}`, { action: "update", status: { this: -1, all: -1 } });
                io?.of(`/workspace-${companyId}`).emit(`company-${companyId}-whatsappSession`, { action: "update", session: wpp });
              }, 500);

              setTimeout(async () => {
                const wpp = await Whatsapp.findByPk(whatsappId);
                if (wpp?.importOldMessages) {
                  ImportWhatsAppMessageService(wpp.id);
                  wpp.update({ statusImportMessages: "Running" });
                }
                io?.of(`/workspace-${companyId}`).emit(`company-${companyId}-whatsappSession`, { action: "update", session: wpp });
              }, 1000 * 45);
            });
          }
        }, 2500);

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            logger.info(
              `Socket  ${name} Connection Update ${connection || ""} ${lastDisconnect ? lastDisconnect.error.message : ""
              }`
            );

            // ZOMBIE CHECK 1: Same-Process Zombie
            // Se o token desta sessão não for o último gerado para este ID, significa que uma nova sessão já foi iniciada neste processo.
            // Esta instância é um Zumbi local. Devemos parar tudo.
            if (sessionTokens.get(whatsapp.id) !== mySessionToken) {
              logger.warn(`[wbot] Sessão ZUMBI local detectada para ${name} (Token mismatch). Encerrando handler silenciosamente.`);
              if (wsocket) {
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
              }
              return;
            }

            if (connection === "close") {
              const errorMsg = lastDisconnect?.error?.message || "";
              console.log("DESCONECTOU", JSON.stringify(lastDisconnect, null, 2))

              // ZOMBIE CHECK 2: Suicide Pact verification
              if (errorMsg.includes("Zombie Fencing")) {
                logger.warn(`[wbot] Conexão fechada por Fencing (Suicídio). Não tentaremos reconectar.`);
                removeWbot(id, false);
                return;
              }

              logger.info(
                `Socket  ${name} Connection Update ${connection || ""} ${errorMsg}`
              );

              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
              const isConflict = statusCode === 440; // Stream Errored (conflict)
              const isForbidden = statusCode === 403;
              const isLoggedOut = statusCode === DisconnectReason.loggedOut;
              const isRestartRequired = statusCode === 515; // Stream Errored (restart required)

              // Só notifica front para exibir modal se for erro que precisa de ação do usuário
              // NÃO mostra modal para 515 (restart) pois reconecta automaticamente
              if (isConflict || isForbidden || isLoggedOut) {
                try {
                  io?.of(`/workspace-${companyId}`)
                    .emit("wa-conn-lost", {
                      whatsappId: id,
                      whatsappName: name, // Nome da conexão para exibição no modal
                      statusCode,
                      reason: errorMsg || "Connection closed",
                      qrUrl: `${process.env.FRONTEND_URL || ""}/connections/${id}`
                    });
                } catch { }
              }

              // Conflito: outra sessão está ativa. NÃO reconectar imediatamente para evitar loop
              if (isConflict) {
                logger.warn(`[wbot] Conflito detectado (440) para ${name}. Verificando propriedade do Lock...`);

                // ZOMBIE CHECK 3: Distributed Zombie
                // Se não somos o dono do lock (Redis), fomos substituídos por outra instância (ou reconexão).
                // Devemos aceitar a morte e NÃO tentar reconectar.
                const isOwner = await checkWbotLock(id);
                if (!isOwner) {
                  logger.warn(`[wbot] NÃO somos o dono do lock para ${name}. Assumindo papel de Zumbi e encerrando sem reconexão.`);
                  removeWbot(id, false);
                  // Limpar token para evitar efeitos colaterais
                  if (sessionTokens.get(id) === mySessionToken) {
                    sessionTokens.delete(id);
                  }
                  return;
                }

                logger.info(`[wbot] Somos o dono do lock, mas houve conflito. Tentando recuperar...`);

                // CORREÇÃO: Verificar se já existe uma tentativa de reconexão em andamento
                if (reconnectingWhatsapps.get(id)) {
                  logger.warn(`[wbot] Já existe uma tentativa de reconexão em andamento para ${name} (id=${id}). Ignorando nova tentativa.`);
                  removeWbot(id, false);
                  return;
                }

                // Incrementar contador de conflitos consecutivos
                const conflictCount = (conflictCountMap.get(id) || 0) + 1;
                conflictCountMap.set(id, conflictCount);

                // Calcular delay com backoff exponencial: 30s, 60s, 120s (máximo)
                const delay = Math.min(BASE_CONFLICT_DELAY * Math.pow(2, conflictCount - 1), MAX_CONFLICT_DELAY);

                logger.warn(`[wbot] Conflito de sessão #${conflictCount} para ${name}. Aguardando ${delay / 1000}s antes de tentar reconectar.`);

                // Marcar como "reconectando" para bloquear novas tentativas
                reconnectingWhatsapps.set(id, true);

                // NOTA: Se somos o dono e vamos reconectar, NÃO devemos liberar o lock!
                // Devemos mantê-lo para que ninguém mais assuma.
                // Mas o wait pode ser longo (30s+). O Heartbeat em StartWhatsAppSessionUnified deve mantê-lo.
                // await releaseWbotLock(id); // REMOVIDO: Manter o lock se vamos tentar recuperar.

                removeWbot(id, false);

                // Agendar reconexão com delay calculado
                // NOTA: NÃO limpar reconnectingWhatsapps aqui! A flag deve permanecer ativa
                // até a conexão ser efetivamente restaurada (connection === "open").
                // Isso evita a janela crítica onde sessão está ausente mas flag indica PARADO.
                setTimeout(() => {
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, delay);

                return;
              }

              if (isForbidden) {
                // Limpar flag de reconexão - erro fatal, não vai reconectar
                reconnectingWhatsapps.delete(id);
                await whatsapp.update({ status: "PENDING", session: "" });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                // remove sessão em filesystem se existir
                try {
                  const baseDir = path.resolve(
                    process.cwd(),
                    process.env.SESSIONS_DIR || "private/sessions",
                    String(whatsapp.companyId || "0"),
                    String(whatsapp.id)
                  );
                  await fs.promises.rm(baseDir, { recursive: true, force: true });
                } catch { }
                io?.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                await releaseWbotLock(id);
                removeWbot(id, false);
                return;
              }

              // Restart required: reconectar com delay curto
              if (isRestartRequired) {
                // Verificar se já está reconectando
                if (reconnectingWhatsapps.get(id)) {
                  logger.warn(`[wbot] Já existe uma tentativa de reconexão em andamento para ${name}. Ignorando restart.`);
                  removeWbot(id, false);
                  return;
                }
                logger.info(`[wbot] Restart necessário para ${name}. Reconectando em 5s.`);
                reconnectingWhatsapps.set(id, true);
                // await releaseWbotLock(id); // REMOVIDO: Manter o lock
                removeWbot(id, false);
                // NOTA: NÃO limpar reconnectingWhatsapps aqui! Flag permanece ativa até connection===open
                setTimeout(() => {
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, 5000);
                return;
              }

              if (!isLoggedOut) {
                // Verificar se já está reconectando
                if (reconnectingWhatsapps.get(id)) {
                  logger.warn(`[wbot] Já existe uma tentativa de reconexão em andamento para ${name}. Ignorando.`);
                  removeWbot(id, false);
                  return;
                }
                reconnectingWhatsapps.set(id, true);
                // await releaseWbotLock(id); // REMOVIDO: Manter o lock se vamos reconectar para evitar que o Cron assuma
                removeWbot(id, false);
                // NOTA: NÃO limpar reconnectingWhatsapps aqui! Flag permanece ativa até connection===open
                setTimeout(() => {
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, 5000);
              } else {
                // Limpar flag de reconexão - logout, não vai reconectar automaticamente
                reconnectingWhatsapps.delete(id);
                await whatsapp.update({ status: "PENDING", session: "" });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                
                // =================================================================
                // LIBERAR LIDERANÇA - MULTI-DEVICE WHATSAPP
                // =================================================================
                // Extrair número do WhatsApp do user JID para liberar liderança
                const phoneNumber = wsocket?.user?.id?.split("@")[0] || "";
                if (phoneNumber && phoneNumber.length >= 10) {
                  try {
                    await releaseLeadership(phoneNumber, whatsapp.id);
                    logger.info(`[wbot] Liderança liberada para ${phoneNumber} (whatsappId=${whatsapp.id})`);
                  } catch (err: any) {
                    logger.error(`[wbot] Erro ao liberar liderança: ${err?.message}`);
                  }
                }
                // =================================================================
                
                // remove sessão em filesystem se existir
                try {
                  const baseDir = path.resolve(
                    process.cwd(),
                    process.env.SESSIONS_DIR || "private/sessions",
                    String(whatsapp.companyId || "0"),
                    String(whatsapp.id)
                  );
                  await fs.promises.rm(baseDir, { recursive: true, force: true });
                } catch { }
                io?.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                await releaseWbotLock(id);
                removeWbot(id, false);
                // Verificar se já está reconectando antes de agendar
                // if (!reconnectingWhatsapps.get(id)) {
                //   reconnectingWhatsapps.set(id, true);
                //   setTimeout(() => {
                //     reconnectingWhatsapps.delete(id);
                //     StartWhatsAppSession(whatsapp, whatsapp.companyId);
                //   }, 10000);
                // }
              }
            }

            if (connection === "open") {
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number:
                  wsocket.type === "md"
                    ? jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
                    : "-"
              });

              io?.of(`/workspace-${companyId}`)
                .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              // CORREÇÃO: Resetar contadores de conflito ao conectar com sucesso
              conflictCountMap.delete(id);
              reconnectingWhatsapps.delete(id);
              
              // Resetar contador de erros Signal ao conectar com sucesso
              try {
                const { default: SignalErrorHandler } = require("../services/WbotServices/SignalErrorHandler");
                SignalErrorHandler.resetErrorCount(id);
              } catch { /* ignore */ }
              
              logger.info(`[wbot] Conexão estabelecida com sucesso para ${name}. Contadores de conflito e Signal resetados.`);

              // BLINDAGEM: Detectar reconexão com mesmo número e migrar histórico
              try {
                const connNumber = whatsapp.number;
                if (connNumber && connNumber !== "-") {
                  const { onConnectionOpen } = require("../services/WhatsappService/WhatsappConnectionGuardService");
                  const migrationResult = await onConnectionOpen(whatsapp.id, companyId, connNumber);
                  if (migrationResult.ticketsMigrated > 0) {
                    logger.warn(
                      `[wbot] BLINDAGEM: Migrados ${migrationResult.ticketsMigrated} tickets ` +
                      `(de conexões [${migrationResult.oldWhatsappIds.join(",")}]) para #${whatsapp.id} (${connNumber})`
                    );
                  }
                }
              } catch (guardErr: any) {
                logger.error(`[wbot] Erro na blindagem ConnectionGuard: ${guardErr?.message}`);
              }

              // NOVO: Carregar labels do banco de dados primeiro (recuperação após reinício)
              try {
                const { loadLabelsFromDatabase, loadChatLabelsFromDatabase } = require("./labelCache");
                const labelsCount = await loadLabelsFromDatabase(whatsapp.id);
                const assocCount = await loadChatLabelsFromDatabase(whatsapp.id);
                logger.info(`[wbot] Labels carregadas do banco: ${labelsCount} labels, ${assocCount} associações para whatsappId=${whatsapp.id}`);
              } catch (e: any) {
                logger.warn(`[wbot] Falha ao carregar labels do banco: ${e?.message}`);
              }

              // Forçar uma sincronização completa do App State ao abrir a conexão
              // try {
              //   const sock: any = wsocket as any;
              //   if (sock && typeof sock.resyncAppState === 'function') {
              //     const { ALL_WA_PATCH_NAMES } = require("@whiskeysockets/baileys");
              //     const labelPatches = (ALL_WA_PATCH_NAMES || []).filter((n: string) => /label/i.test(n));
              //     logger.info(`[wbot] Triggering initial resyncAppState for whatsappId=${whatsapp.id}. Label patches: ${JSON.stringify(labelPatches)}`);
              //     // Primeiro tenta resync focado em labels
              //     if (Array.isArray(labelPatches) && labelPatches.length > 0) {
              //       try {
              //         await sock.resyncAppState(labelPatches, true);
              //         logger.info(`[wbot] Label-only resync requested for whatsappId=${whatsapp.id}`);
              //       } catch (e: any) {
              //         logger.warn(`[wbot] Label-only resync failed: ${e?.message}`);
              //       }
              //     }
              //     // Em seguida, faz um resync completo como fallback
              //     try {
              //       await sock.resyncAppState(ALL_WA_PATCH_NAMES, true);
              //       logger.info(`[wbot] Full resyncAppState requested for whatsappId=${whatsapp.id}`);
              //     } catch (e: any) {
              //       logger.warn(`[wbot] full resyncAppState failed: ${e?.message}`);
              //     }
              //   }
              // } catch (e: any) {
              //   logger.warn(`[wbot] initial resyncAppState failed: ${e?.message}`);
              // }

              // Sincronizar todos os grupos do WhatsApp como contatos+tickets
              // Executa com delay para não sobrecarregar a conexão recém-aberta
              // setTimeout(async () => {
              //   try {
              //     const SyncAllGroupsService = require("../services/WbotServices/SyncAllGroupsService").default;
              //     const syncResult = await SyncAllGroupsService({ whatsappId: whatsapp.id, companyId });
              //     logger.info(`[wbot] Sync de grupos concluído para whatsappId=${whatsapp.id}: ${JSON.stringify(syncResult)}`);
              //   } catch (e: any) {
              //     logger.warn(`[wbot] Falha ao sincronizar grupos: ${e?.message}`);
              //   }
              // }, 10000);

              // NOTA: wbotMessageListener é iniciado pelo StartWhatsAppSessionUnified.ts
              logger.info(`[wbot] Conexão estabelecida para whatsappId=${whatsapp.id}`);

              // Nota: lid-mapping.update é tratado pelo wbotMonitor.ts (com reconciliação completa)

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsappUpdate.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsappUpdate.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                io?.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsappUpdate
                  });
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                
                // LIMPEZA SIGNAL: Na primeira geração de QR (nova conexão), limpar chaves antigas
                // Isso garante uma "renovação completa" da sessão, evitando Bad MAC de chaves corrompidas
                const isFirstQr = !retriesQrCodeMap.has(id);
                if (isFirstQr) {
                  logger.info(`[SignalCleanup] Primeiro QR Code detectado para ${name} - limpando Signal keys antigos...`);
                  SignalCleanupService.cleanupSession(id, companyId)
                    .then(result => {
                      if (result.success) {
                        logger.info(`[SignalCleanup] ✅ Sessão renovada: ${result.deleted} arquivos Signal limpos, ${result.preserved} preservados (creds/app-state)`);
                      } else {
                        logger.warn(`[SignalCleanup] ⚠️  Limpeza falhou: ${result.error}`);
                      }
                    })
                    .catch(err => {
                      logger.error(`[SignalCleanup] ❌ Erro inesperado: ${err?.message}`);
                    });
                }
                
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });
                const sessionIndex = sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                io?.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveCreds);


        // Handler geral: extrai labels de messaging-history.set e atualiza caches/persistência
        try {
          const { upsertLabel, addChatLabelAssociation, getChatLabelIds } = require("../libs/labelCache");
          // Redundância: capturar labels.edit aqui também para garantir inventário
          (wsocket.ev as any).on("labels.edit", (payload: any) => {
            try {
              // logger.info(`[wbot] labels.edit recebido: ${JSON.stringify(payload)}`);
              const items = Array.isArray(payload) ? payload : [payload];
              for (const item of items) {
                const id = String(item?.id || "");
                if (!id) continue;
                const name = String(item?.name || id);
                const color = item?.color;
                const deleted = item?.deleted === true;
                // logger.info(`[wbot] Processando label: ID=${id}, Nome=${name}, Deletada=${deleted}`);
                upsertLabel(whatsapp.id, { id, name, color, predefinedId: item?.predefinedId, deleted });
              }
            } catch (e: any) {
              logger.warn(`[wbot] labels.edit upsert failed: ${e?.message}`);
            }
          });

          // Handler para labels.association - crítico para popular o cache
          (wsocket.ev as any).on("labels.association", (payload: any) => {
            try {
              // logger.info(`[wbot] labels.association recebido: ${JSON.stringify(payload)}`);
              if (payload && typeof payload === 'object') {
                const associations = payload.associations || payload;
                if (Array.isArray(associations)) {
                  for (const assoc of associations) {
                    const chatId = String(assoc?.chatId || assoc?.jid || "");
                    const labelId = String(assoc?.labelId || assoc?.id || "");
                    if (chatId && labelId) {
                      // logger.info(`[wbot] Associando chat ${chatId} com label ${labelId}`);
                      addChatLabelAssociation(whatsapp.id, chatId, labelId, true);
                    }
                  }
                } else if (associations.chatId && associations.labelId) {
                  const chatId = String(associations.chatId);
                  const labelId = String(associations.labelId);
                  // logger.info(`[wbot] Associando chat ${chatId} com label ${labelId}`);
                  addChatLabelAssociation(whatsapp.id, chatId, labelId, true);
                }
              }
            } catch (e: any) {
              logger.warn(`[wbot] labels.association handler failed: ${e?.message}`);
            }
          });

          // Handler centralizado de messaging-history.set
          // Este handler processa todos os eventos de history sync e distribui para handlers registrados
          wsocket.ev.on("messaging-history.set", async (messageSet: any) => {
            await handleMessagingHistorySet(messageSet);
          });

          // Processamento em tempo real de labels vindas por updates de chats
          const handleChatLabelUpdate = async (payload: any, source: string) => {
            try {
              const items = Array.isArray(payload) ? payload : [payload];
              const batch: any[] = [];
              for (const c of items) {
                const jid = String(c?.id || c?.jid || "");
                if (!jid) continue;
                const raw = Array.isArray(c?.labels) ? c.labels : (Array.isArray(c?.labelIds) ? c.labelIds : []);
                // Se vierem objetos de label, upsert no inventário
                for (const lab of (Array.isArray(c?.labels) ? c.labels : [])) {
                  try {
                    const lid = String(lab?.id || lab?.value || "");
                    if (!lid) continue;
                    const lname = String(lab?.name || lab?.label || lab?.title || lid);
                    const lcolor = lab?.color || lab?.colorHex || lab?.backgroundColor;
                    upsertLabel(whatsapp.id, { id: lid, name: lname, color: lcolor });
                  } catch { }
                }
                const ids: string[] = Array.from(new Set((raw || []).map((x: any) => String(typeof x === 'object' ? (x.id ?? x.value ?? x) : x))));
                if (!ids.length) continue;
                for (const lid of ids) addChatLabelAssociation(whatsapp.id, jid, lid, true);
                batch.push({ id: jid, labels: ids, labelsAbsolute: true });
              }
              if (batch.length) {
                await createOrUpdateBaileysService({ whatsappId: whatsapp.id, chats: batch as any });
                // logger.info(`[wbot] persisted ${batch.length} chat label updates from ${source}`);
              }
            } catch (e: any) {
              logger.warn(`[wbot] handleChatLabelUpdate failed (${source}): ${e?.message}`);
            }
          };

          wsocket.ev.on("chats.upsert" as any, async (payload: any) => handleChatLabelUpdate(payload, 'chats.upsert'));
          wsocket.ev.on("chats.update" as any, async (payload: any) => handleChatLabelUpdate(payload, 'chats.update'));
        } catch (e: any) {
          logger.warn(`[wbot] failed to register messaging-history.set handler: ${e?.message}`);
        }
      })();
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
