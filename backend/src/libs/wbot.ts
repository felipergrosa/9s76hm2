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
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
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

const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

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
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
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
        const io = getIO();
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
          browser: Browsers.appropriate("Desktop"),
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
                io.of(`/workspace-${companyId}`).emit(`importMessages-${wpp.companyId}`, { action: "update", status: { this: -1, all: -1 } });
                io.of(`/workspace-${companyId}`).emit(`company-${companyId}-whatsappSession`, { action: "update", session: wpp });
              }, 500);

              setTimeout(async () => {
                const wpp = await Whatsapp.findByPk(whatsappId);
                if (wpp?.importOldMessages) {
                  ImportWhatsAppMessageService(wpp.id);
                  wpp.update({ statusImportMessages: "Running" });
                }
                io.of(`/workspace-${companyId}`).emit(`company-${companyId}-whatsappSession`, { action: "update", session: wpp });
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
                  io.of(`/workspace-${companyId}`)
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
                setTimeout(() => {
                  // Liberar o mutex antes de tentar reconectar (para permitir que StartSession renove/adquira)
                  // Não, StartSession vai tentar adquirir. Se já temos, ok (reentrante).

                  reconnectingWhatsapps.delete(id);
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, delay);

                return;
              }

              if (isForbidden) {
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
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                await releaseWbotLock(id);
                removeWbot(id, false);
                return;
              }

              // Restart required: reconectar com delay moderado
              if (isRestartRequired) {
                // Verificar se já está reconectando
                if (reconnectingWhatsapps.get(id)) {
                  logger.warn(`[wbot] Já existe uma tentativa de reconexão em andamento para ${name}. Ignorando restart.`);
                  removeWbot(id, false);
                  return;
                }
                logger.info(`[wbot] Restart necessário para ${name}. Reconectando em 15s.`);
                reconnectingWhatsapps.set(id, true);
                // await releaseWbotLock(id); // REMOVIDO: Manter o lock
                removeWbot(id, false);
                setTimeout(() => {
                  reconnectingWhatsapps.delete(id);
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, 15000);
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
                setTimeout(() => {
                  reconnectingWhatsapps.delete(id);
                  StartWhatsAppSession(whatsapp, whatsapp.companyId);
                }, 10000);
              } else {
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
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                await releaseWbotLock(id);
                removeWbot(id, false);
                // Verificar se já está reconectando antes de agendar
                if (!reconnectingWhatsapps.get(id)) {
                  reconnectingWhatsapps.set(id, true);
                  setTimeout(() => {
                    reconnectingWhatsapps.delete(id);
                    StartWhatsAppSession(whatsapp, whatsapp.companyId);
                  }, 10000);
                }
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

              io.of(`/workspace-${companyId}`)
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
              logger.info(`[wbot] Conexão estabelecida com sucesso para ${name}. Contadores de conflito resetados.`);

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
              try {
                const sock: any = wsocket as any;
                if (sock && typeof sock.resyncAppState === 'function') {
                  const { ALL_WA_PATCH_NAMES } = require("@whiskeysockets/baileys");
                  const labelPatches = (ALL_WA_PATCH_NAMES || []).filter((n: string) => /label/i.test(n));
                  logger.info(`[wbot] Triggering initial resyncAppState for whatsappId=${whatsapp.id}. Label patches: ${JSON.stringify(labelPatches)}`);
                  // Primeiro tenta resync focado em labels
                  if (Array.isArray(labelPatches) && labelPatches.length > 0) {
                    try {
                      await sock.resyncAppState(labelPatches, true);
                      logger.info(`[wbot] Label-only resync requested for whatsappId=${whatsapp.id}`);
                    } catch (e: any) {
                      logger.warn(`[wbot] Label-only resync failed: ${e?.message}`);
                    }
                  }
                  // Em seguida, faz um resync completo como fallback
                  try {
                    await sock.resyncAppState(ALL_WA_PATCH_NAMES, true);
                    logger.info(`[wbot] Full resyncAppState requested for whatsappId=${whatsapp.id}`);
                  } catch (e: any) {
                    logger.warn(`[wbot] full resyncAppState failed: ${e?.message}`);
                  }
                }
              } catch (e: any) {
                logger.warn(`[wbot] initial resyncAppState failed: ${e?.message}`);
              }

              // NOVO: Escutar evento lid-mapping.update para persistir mapeamentos LID → Número
              // Isso resolve o problema de contatos duplicados causado por LIDs
              try {
                wsocket.ev.on("lid-mapping.update" as any, async (mappings: any) => {
                  try {
                    const LidMapping = require("../models/LidMapping").default;
                    const mappingsArray = Array.isArray(mappings) ? mappings : [mappings];

                    for (const mapping of mappingsArray) {
                      const lid = mapping?.lid || mapping?.id;
                      const pn = mapping?.pn || mapping?.phoneNumber || mapping?.number;

                      if (!lid || !pn) continue;

                      // Extrair apenas dígitos do número
                      const phoneDigits = pn.replace(/\D/g, "");
                      if (phoneDigits.length < 10 || phoneDigits.length > 13) continue;

                      // Upsert no banco
                      await LidMapping.upsert({
                        lid: lid.includes("@") ? lid : `${lid}@lid`,
                        phoneNumber: phoneDigits,
                        companyId,
                        whatsappId: whatsapp.id
                      });

                      logger.info(`[wbot] LID mapeado e persistido: ${lid} → ${phoneDigits}`);
                    }
                  } catch (err: any) {
                    logger.warn(`[wbot] Erro ao persistir lid-mapping: ${err?.message}`);
                  }
                });
                logger.info(`[wbot] Evento lid-mapping.update registrado para whatsappId=${whatsapp.id}`);
              } catch (e: any) {
                logger.warn(`[wbot] Falha ao registrar lid-mapping.update: ${e?.message}`);
              }

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
                io.of(`/workspace-${companyId}`)
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

                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveCreds);

        // Diagnóstico temporário (até estabilizar labels): logar eventos relevantes por 5 minutos
        try {
          const start = Date.now();
          const logEvent = (name: string) => (payload: any) => {
            if (Date.now() - start > 5 * 60 * 1000) return; // 5 min
            const size = (() => { try { return JSON.stringify(payload).length; } catch { return -1; } })();
            logger.info(`[wbot][ev:${name}] size=${size}`);
            // Log detalhado para labels.edit (para debug de tags novas)
            if (name === "labels.edit" && payload) {
              try {
                const items = Array.isArray(payload) ? payload : [payload];
                items.forEach((item: any) => {
                  if (item?.id && item?.name) {
                    logger.info(`[wbot][labels.edit] ID: ${item.id}, Nome: ${item.name}, Cor: ${item.color || 'N/A'}`);
                  }
                });
              } catch { }
            }
          };
          (wsocket.ev as any).on("labels.relations", logEvent("labels.relations"));
          wsocket.ev.on("labels.edit" as any, logEvent("labels.edit"));
          wsocket.ev.on("labels.association" as any, logEvent("labels.association"));
          wsocket.ev.on("messaging-history.set" as any, logEvent("messaging-history.set"));
          wsocket.ev.on("chats.update", logEvent("chats.update"));
          wsocket.ev.on("chats.upsert", logEvent("chats.upsert"));
        } catch (e) {
          logger.warn(`[wbot] não foi possível registrar logs de diagnóstico: ${e?.message}`);
        }

        // Handler geral: extrai labels de messaging-history.set e atualiza caches/persistência
        try {
          const { upsertLabel, addChatLabelAssociation, getChatLabelIds } = require("../libs/labelCache");
          // Redundância: capturar labels.edit aqui também para garantir inventário
          (wsocket.ev as any).on("labels.edit", (payload: any) => {
            try {
              logger.info(`[wbot] labels.edit recebido: ${JSON.stringify(payload)}`);
              const items = Array.isArray(payload) ? payload : [payload];
              for (const item of items) {
                const id = String(item?.id || "");
                if (!id) continue;
                const name = String(item?.name || id);
                const color = item?.color;
                const deleted = item?.deleted === true;
                logger.info(`[wbot] Processando label: ID=${id}, Nome=${name}, Deletada=${deleted}`);
                upsertLabel(whatsapp.id, { id, name, color, predefinedId: item?.predefinedId, deleted });
              }
            } catch (e: any) {
              logger.warn(`[wbot] labels.edit upsert failed: ${e?.message}`);
            }
          });

          // Handler para labels.association - crítico para popular o cache
          (wsocket.ev as any).on("labels.association", (payload: any) => {
            try {
              logger.info(`[wbot] labels.association recebido: ${JSON.stringify(payload)}`);
              if (payload && typeof payload === 'object') {
                const associations = payload.associations || payload;
                if (Array.isArray(associations)) {
                  for (const assoc of associations) {
                    const chatId = String(assoc?.chatId || assoc?.jid || "");
                    const labelId = String(assoc?.labelId || assoc?.id || "");
                    if (chatId && labelId) {
                      logger.info(`[wbot] Associando chat ${chatId} com label ${labelId}`);
                      addChatLabelAssociation(whatsapp.id, chatId, labelId, true);
                    }
                  }
                } else if (associations.chatId && associations.labelId) {
                  const chatId = String(associations.chatId);
                  const labelId = String(associations.labelId);
                  logger.info(`[wbot] Associando chat ${chatId} com label ${labelId}`);
                  addChatLabelAssociation(whatsapp.id, chatId, labelId, true);
                }
              }
            } catch (e: any) {
              logger.warn(`[wbot] labels.association handler failed: ${e?.message}`);
            }
          });

          wsocket.ev.on("messaging-history.set", async (messageSet: any) => {
            try {
              const wppId = whatsapp.id;
              const labels = Array.isArray(messageSet?.labels) ? messageSet.labels : [];
              const chats = Array.isArray(messageSet?.chats) ? messageSet.chats : [];
              if (labels.length) {
                labels.forEach((l: any) => {
                  if (l?.id) upsertLabel(wppId, { id: String(l.id), name: String(l.name || l.id), color: l.color });
                });
              }
              if (chats.length) {
                for (const c of chats) {
                  const jid = String(c?.id || c?.jid || "");
                  const clabels: string[] = Array.isArray(c?.labels) ? c.labels.map((x: any) => String(x)) : [];
                  if (jid && clabels.length) {
                    for (const lid of clabels) {
                      addChatLabelAssociation(wppId, jid, lid, true);
                    }
                  }
                }
                // Persistir labels por chat em Baileys.chats
                try {
                  const batch = chats
                    .map((c: any) => ({ id: String(c?.id || c?.jid || ""), labels: Array.isArray(c?.labels) ? c.labels.map((x: any) => String(x)) : [] }))
                    .filter((x: any) => x.id && x.labels.length);
                  if (batch.length) {
                    await createOrUpdateBaileysService({ whatsappId: whatsapp.id, chats: batch.map((b: any) => ({ ...b, labelsAbsolute: true })) });
                  }
                } catch (e: any) {
                  logger.warn(`[wbot] persist from messaging-history.set failed: ${e?.message}`);
                }
              }
            } catch (e: any) {
              logger.warn(`[wbot] messaging-history.set label extract failed: ${e?.message}`);
            }
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
                logger.info(`[wbot] persisted ${batch.length} chat label updates from ${source}`);
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
