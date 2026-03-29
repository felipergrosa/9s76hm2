import * as Sentry from "@sentry/node";
import makeWASocket, {
  AuthenticationState,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WAVersion,
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
import { handleMessagingHistorySet } from "./messageHistoryHandler";
import SignalErrorHandler from "../services/WbotServices/SignalErrorHandler";
import SignalCleanupService from "../services/WbotServices/SignalCleanupService";
import { EventTrigger } from "../queue/EventTrigger";
import { createTurboSocket, isTurboEnabled, withTurboSupport } from "../helpers/TurboIntegration";

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
// VALOR = timestamp (Date.now()) de quando a flag foi ativada, para detectar deadlocks
const reconnectingWhatsapps = new Map<number, number>();

// Timeout máximo para flag de reconexão (evita deadlock se reconexão falhar)
const RECONNECT_FLAG_TIMEOUT_MS = 60_000; // 60 segundos

// Tempo máximo que a flag pode ficar ativa antes de ser considerada "stale" (morta)
const RECONNECT_STALE_THRESHOLD_MS = 60_000; // 1 minuto (reduzido de 2min)

// Helper para expor estado de reconexão para outros módulos (ex: HealthCheck)
export const getWbotIsReconnecting = (whatsappId: number): boolean => {
  const ts = reconnectingWhatsapps.get(whatsappId);
  if (!ts) return false;
  
  // Se a flag está ativa há mais de 2 minutos, considerar deadlock e limpar
  const age = Date.now() - ts;
  if (age > RECONNECT_STALE_THRESHOLD_MS) {
    logger.warn(`[wbot] Flag de reconexão STALE para whatsappId=${whatsappId} (${Math.round(age / 1000)}s). Limpando deadlock.`);
    reconnectingWhatsapps.delete(whatsappId);
    return false;
  }
  
  return true;
};

// Helper para limpar flag de reconexão (usado em timeout e quando conexão estabelecida)
export const clearReconnectingFlag = (whatsappId: number) => {
  reconnectingWhatsapps.delete(whatsappId);
  logger.debug(`[wbot] Flag de reconexão limpa para whatsappId=${whatsappId}`);
};

// Helper para expor IDs das sessões ativas (para checkOrphanedSessionsCron)
export const getWbotSessionIds = (): number[] => {
  return sessions.map(s => s.id);
};

// Helper para verificar se sessão já existe (para evitar inicialização duplicada)
export const getWbotSessionExists = (whatsappId: number): boolean => {
  return sessions.findIndex(s => s.id === whatsappId) !== -1;
};

// Map para contar conflitos consecutivos (para backoff exponencial)
const conflictCountMap = new Map<number, number>();
// Constantes de tempo para reconexão
const BASE_CONFLICT_DELAY = 30_000; // 30 segundos base
const MAX_CONFLICT_DELAY = 120_000; // 2 minutos máximo

// ========== CIRCUIT BREAKER (para erros críticos de protocolo) ==========
// Rastreia falhas de reconexão por whatsappId
const circuitBreakerMap = new Map<number, {
  count: number;           // Número de falhas consecutivas
  firstFailure: number;    // Timestamp da primeira falha
  lastFailure: number;     // Timestamp da última falha
  lastError: string;       // Mensagem do último erro
  openUntil: number;       // Timestamp até quando o circuito está aberto
}>();

// Configuração do Circuit Breaker
const CIRCUIT_BREAKER_THRESHOLD = 5;           // Após 5 falhas, abre o circuito
const CIRCUIT_BREAKER_WINDOW_MS = 300_000;     // Janela de 5 minutos
const CIRCUIT_BREAKER_COOLDOWN_MS = 300_000;   // 5 minutos de cooldown após abrir
const CIRCUIT_BREAKER_MAX_DELAY = 60_000;      // Delay máximo de reconexão

// Erros críticos de protocolo que devem disparar o circuit breaker
const CRITICAL_PROTOCOL_ERRORS = [
  'xml-not-well-formed',
  'XML not well-formed',
  'stream errored',
  'Stream Errored',
  'connection reset',
  'Connection reset',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];

// Helper para verificar se um erro é crítico de protocolo
const isCriticalProtocolError = (errorMsg: string): boolean => {
  return CRITICAL_PROTOCOL_ERRORS.some(e => errorMsg.toLowerCase().includes(e.toLowerCase()));
};

// Helper para registrar falha no circuit breaker
const recordCircuitBreakerFailure = (whatsappId: number, errorMsg: string): {
  shouldBlock: boolean;
  delayMs: number;
} => {
  const now = Date.now();
  let cb = circuitBreakerMap.get(whatsappId);
  
  if (!cb) {
    cb = { count: 0, firstFailure: now, lastFailure: now, lastError: '', openUntil: 0 };
    circuitBreakerMap.set(whatsappId, cb);
  }
  
  // Resetar se passou da janela
  if (now - cb.firstFailure > CIRCUIT_BREAKER_WINDOW_MS) {
    cb.count = 0;
    cb.firstFailure = now;
  }
  
  cb.count++;
  cb.lastFailure = now;
  cb.lastError = errorMsg;
  
  // Verificar se atingiu threshold
  if (cb.count >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.openUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;
    logger.error(
      `[CircuitBreaker] CIRCUITO ABERTO para whatsappId=${whatsappId}. ` +
      `${cb.count} falhas em ${Math.round((now - cb.firstFailure) / 1000)}s. ` +
      `Bloqueando reconexões por ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s. ` +
      `Último erro: ${errorMsg}`
    );
    return { shouldBlock: true, delayMs: CIRCUIT_BREAKER_COOLDOWN_MS };
  }
  
  // Backoff exponencial: 3s, 6s, 12s, 24s, 60s (mais agressivo nos primeiros erros)
  const delayMs = Math.min(3000 * Math.pow(2, cb.count - 1), CIRCUIT_BREAKER_MAX_DELAY);
  logger.warn(
    `[CircuitBreaker] Falha #${cb.count} para whatsappId=${whatsappId}. ` +
    `Próxima tentativa em ${delayMs / 1000}s. Erro: ${errorMsg}`
  );
  
  return { shouldBlock: false, delayMs };
};

// Helper para verificar se o circuito está aberto
const isCircuitBreakerOpen = (whatsappId: number): { open: boolean; remainingMs: number } => {
  const cb = circuitBreakerMap.get(whatsappId);
  if (!cb || cb.openUntil === 0) return { open: false, remainingMs: 0 };
  
  const now = Date.now();
  if (now < cb.openUntil) {
    return { open: true, remainingMs: cb.openUntil - now };
  }
  
  // Circuito fechado novamente
  cb.openUntil = 0;
  return { open: false, remainingMs: 0 };
};

// Helper para resetar circuit breaker (chamado quando conexão bem-sucedida)
const resetCircuitBreaker = (whatsappId: number): void => {
  circuitBreakerMap.delete(whatsappId);
  logger.info(`[CircuitBreaker] Resetado para whatsappId=${whatsappId}`);
};

// Exportar para uso em health checks
export const getCircuitBreakerStatus = (whatsappId: number): any => {
  const cb = circuitBreakerMap.get(whatsappId);
  if (!cb) return { status: 'closed', failures: 0 };
  
  const { open, remainingMs } = isCircuitBreakerOpen(whatsappId);
  return {
    status: open ? 'open' : 'closed',
    failures: cb.count,
    lastError: cb.lastError,
    lastFailure: cb.lastFailure ? new Date(cb.lastFailure).toISOString() : null,
    remainingCooldown: open ? remainingMs : 0
  };
};
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
    // Usa getWbotIsReconnecting() que detecta e limpa flags stale (> 2min)
    const isReconnecting = getWbotIsReconnecting(whatsappId);
    
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
    // getWbotIsReconnecting() limpa flags stale (> 2min) automaticamente
    if (getWbotIsReconnecting(whatsappId)) {
      logger.debug(`[triggerSessionRecovery] ${whatsappId} já está em processo de reconexão`);
      return;
    }
    
    logger.info(`[triggerSessionRecovery] Iniciando recovery para whatsappId=${whatsappId}`);
    reconnectingWhatsapps.set(whatsappId, Date.now());
    
    // TIMEOUT DE SEGURANÇA: Limpar flag após 60s se a reconexão não acontecer
    // Isso evita que a flag fique presa para sempre em caso de falha silenciosa
    const safetyTimeout = setTimeout(() => {
      if (reconnectingWhatsapps.get(whatsappId)) {
        logger.warn(`[triggerSessionRecovery] Timeout de segurança (60s) - limpando flag para ${whatsappId}`);
        reconnectingWhatsapps.delete(whatsappId);
      }
    }, 60000);
    
    // Buscar WhatsApp no banco
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[triggerSessionRecovery] WhatsApp ${whatsappId} não encontrado no banco`);
      reconnectingWhatsapps.delete(whatsappId);
      clearTimeout(safetyTimeout);
      return;
    }

    logger.info(`[triggerSessionRecovery] WhatsApp ${whatsappId} encontrado: status=${whatsapp.status}, channel=${whatsapp.channel}, name=${whatsapp.name}`);

    // Verificar se deve estar conectado
    // Aceita tanto "whatsapp" (Baileys) quanto "official" (API Oficial)
    if (whatsapp.status === "DISCONNECTED" || 
        (whatsapp.channel !== "whatsapp" && whatsapp.channelType !== "official")) {
      logger.info(`[triggerSessionRecovery] WhatsApp ${whatsappId} status=${whatsapp.status}, channel=${whatsapp.channel}, channelType=${whatsapp.channelType}. Não recuperando.`);
      reconnectingWhatsapps.delete(whatsappId);
      clearTimeout(safetyTimeout);
      return;
    }

    logger.info(`[triggerSessionRecovery] Chamando StartWhatsAppSession para ${whatsappId} (${whatsapp.name})`);
    
    // Importar dinamicamente para evitar dependência circular
    const { StartWhatsAppSession } = await import("../services/WbotServices/StartWhatsAppSessionUnified");
    await StartWhatsAppSession(whatsapp, whatsapp.companyId);
    
    logger.info(`[triggerSessionRecovery] StartWhatsAppSession completado para ${whatsappId}`);
    clearTimeout(safetyTimeout);
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
      const session = sessions[sessionIndex];

      // LIMPAR INTERVALS DO wbotMonitor para evitar loop de reconexão
      // Isso é CRÍTICO para prevenir conflitos (conflict: replaced)
      const intervalsToClear = [
        '_healthCheckInterval',
        '_androidSyncInterval',
        '_androidKeepaliveInterval',
        '_lidPollInterval',
        '_activityCheckInterval'
      ];

      for (const intervalKey of intervalsToClear) {
        const interval = (session as any)[intervalKey];
        if (interval) {
          try {
            clearInterval(interval);
            logger.debug(`[removeWbot] Interval ${intervalKey} limpo para whatsappId=${whatsappId}`);
          } catch (e) {
            // Ignorar erro ao limpar interval
          }
          (session as any)[intervalKey] = undefined;
        }
      }

      if (isLogout) {
        session.logout();
        session.ws.close();
      }

      sessions.splice(sessionIndex, 1);
      logger.info(`[removeWbot] Sessão ${whatsappId} removida do pool (isLogout=${isLogout})`);
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

        let version: WAVersion;
        let isLatest: boolean | undefined;

        try {
          const latestBaileys = await fetchLatestBaileysVersion();
          version = latestBaileys.version as WAVersion;
          isLatest = latestBaileys.isLatest;
          logger.info(`[wbot] Usando fetchLatestBaileysVersion para ${name}`);
        } catch (versionError: any) {
          logger.warn(`[wbot] Falha ao obter versão via fetchLatestBaileysVersion para ${name}: ${versionError?.message}`);
          const latestWaWeb = await fetchLatestWaWebVersion({});
          version = latestWaWeb.version as WAVersion;
          isLatest = latestWaWeb.isLatest;
          logger.info(`[wbot] Fallback para fetchLatestWaWebVersion em ${name}`);
        }

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

        // Turbo Connector: Log informativo (integração segura)
        if (isTurboEnabled()) {
          logger.info(`[TURBO] Turbo Connector HABILITADO para sessão ${name} (mode: ${process.env.TURBO_MODE || "hybrid"})`);
          logger.info(`[TURBO] Engines disponíveis: Baileys (primário), WEBJS (fallback)`);
        }

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
          // syncFullHistory DESABILITADO por padrão - causa sobrecarga na reconexão
          // Use o botão "Sincronizar Histórico" na página de conexões para sync manual organizado
          syncFullHistory: false, // Era: !!whatsapp.importOldMessages
        });

        // Turbo Connector: Aplicar wrapper se habilitado
        if (isTurboEnabled()) {
          try {
            const sessionPath = path.join(process.env.SESSIONS_DIR || "private/sessions", `whatsapp-${whatsapp.id}`);
            wsocket = await withTurboSupport(wsocket, whatsapp, sessionPath) as WASocket;
            logger.info(`[TURBO] TurboWrapper aplicado com sucesso para sessão ${name}`);
          } catch (error: any) {
            logger.error(`[TURBO] Erro ao aplicar TurboWrapper: ${error.message}`);
            logger.warn(`[TURBO] Continuando com Baileys direto (fallback)`);
            // Continua com wsocket original (Baileys direto)
          }
        }

        wsocket.ev.on("connection.update", async (update) => {
          const { connection } = update;
          if (connection === 'close') {
            // Heartbeat cleanup managed externally
          }
        });

        // Handler de messaging-history.set DESABILITADO - syncFullHistory agora é sob demanda
        // O sync automático causava sobrecarga ao reconectar após dias desconectado
        // Use o endpoint POST /whatsapp/:id/sync-full-history para sync manual organizado
        /*
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
                // Baileys v7: messageTimestamp pode ser number ou Long (objeto com .low)
                const rawTs = msg.messageTimestamp;
                const tsSeconds = typeof rawTs === "number" ? rawTs
                  : (rawTs?.low ?? rawTs?.toNumber?.() ?? Number(rawTs) ?? 0);
                const timestampMsg = Math.floor(tsSeconds * 1000);
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
        */
        // FIM DO CÓDIGO COMENTADO - sync automático desabilitado

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            // Log apenas em DEBUG para heartbeat (evita spam no terminal)
            logger.debug(
              `Socket  ${name} Connection Update ${connection || ""} ${lastDisconnect ? lastDisconnect.error.message : ""
              }`
            );

            // Single-instance: sem verificação de zumbi

            if (connection === "close") {
              // DISPARO DE EVENTO DESATIVADO - Conflito com sessão WhatsApp
            // EventTrigger.emitSessionDisconnected() causa Bad MAC Error
            // ao acessar sessão simultaneamente com Baileys auto-recovery
            /*
            try {
              await EventTrigger.emitSessionDisconnected(id, lastDisconnect?.error?.message || "Connection closed");
            } catch (err: any) {
              logger.error(`[wbot] Erro ao emitir sessionDisconnected: ${err.message}`);
            }
            */
              
              const errorMsg = lastDisconnect?.error?.message || "";
              console.log("DESCONECTOU", JSON.stringify(lastDisconnect, null, 2))

              logger.info(
                `Socket  ${name} Connection Update ${connection || ""} ${errorMsg}`
              );

              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
              const isConflict = statusCode === 440; // Stream Errored (conflict)
              const isForbidden = statusCode === 403;
              const isConnectionFailure = statusCode === 405;
              const isLoggedOut = statusCode === DisconnectReason.loggedOut;
              const isRestartRequired = statusCode === 515; // Stream Errored (restart required)
              
              // CORREÇÃO: Detectar xml-not-well-formed que corrompe o socket
              const isXmlNotWellFormed = errorMsg.includes('xml-not-well-formed') || 
                                         errorMsg.includes('XML not well-formed');
              
              if (isXmlNotWellFormed) {
                logger.error(`[wbot] ERRO CRÍTICO: xml-not-well-formed detectado para ${name}. Isso indica corrupção do WebSocket.`);
                logger.error(`[wbot] Último erro: ${JSON.stringify(lastDisconnect, null, 2)}`);
              }

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

              // Conflito: outra sessão está ativa. Aguardar antes de reconectar
              if (isConflict) {
                logger.warn(`[wbot] Conflito detectado (440) para ${name}. Aguardando antes de reconectar...`);

                // CORREÇÃO: Verificar se já existe uma tentativa de reconexão em andamento
                // getWbotIsReconnecting() limpa flags stale (> 2min)
                if (getWbotIsReconnecting(id)) {
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
                reconnectingWhatsapps.set(id, Date.now());
                
                // TIMEOUT DE SEGURANÇA: Limpar flag E disparar reconexão após 60s se sessão não voltou
                setTimeout(async () => {
                  if (reconnectingWhatsapps.get(id) && !sessions.find(s => s.id === id)) {
                    logger.warn(`[wbot] Timeout de segurança (60s) para conflito ${name} - sessão não voltou. Disparando recovery.`);
                    reconnectingWhatsapps.delete(id);
                    try {
                      const freshWa = await Whatsapp.findByPk(id);
                      if (freshWa && freshWa.status !== "PENDING") {
                        await StartWhatsAppSession(freshWa, freshWa.companyId);
                      }
                    } catch (recoveryErr: any) {
                      logger.error(`[wbot] Erro no recovery após timeout conflito para ${name}: ${recoveryErr?.message}`);
                    }
                  }
                }, RECONNECT_FLAG_TIMEOUT_MS);

                // NOTA: Se somos o dono e vamos reconectar, NÃO devemos liberar o lock!
                // Devemos mantê-lo para que ninguém mais assuma.
                // Mas o wait pode ser longo (30s+). O Heartbeat em StartWhatsAppSessionUnified deve mantê-lo.
                // await releaseWbotLock(id); // REMOVIDO: Manter o lock se vamos tentar recuperar.

                removeWbot(id, false);

                // Agendar reconexão com delay calculado
                // NOTA: NÃO limpar reconnectingWhatsapps aqui! A flag deve permanecer ativa
                // até a conexão ser efetivamente restaurada (connection === "open").
                // Isso evita a janela crítica onde sessão está ausente mas flag indica PARADO.
                setTimeout(async () => {
                  try {
                    await StartWhatsAppSession(whatsapp, whatsapp.companyId);
                  } catch (err: any) {
                    logger.error(`[wbot] Erro na reconexão agendada para ${name}: ${err?.message}`);
                    reconnectingWhatsapps.delete(id);
                  }
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

              if (isConnectionFailure) {
                // 405 (Connection Failure): normalmente indica sessão/handshake inválido ou bloqueado.
                // Não adianta reconectar em loop: forçar nova autenticação via QR.
                reconnectingWhatsapps.delete(id);

                try {
                  await whatsapp.update({ status: "DISCONNECTED", session: "" });
                } catch { }

                try {
                  await DeleteBaileysService(whatsapp.id);
                } catch { }

                try {
                  await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                } catch { }

                try {
                  const baseDir = path.resolve(
                    process.cwd(),
                    process.env.SESSIONS_DIR || "private/sessions",
                    String(whatsapp.companyId || "0"),
                    String(whatsapp.id)
                  );
                  await fs.promises.rm(baseDir, { recursive: true, force: true });
                } catch { }

                try {
                  io?.of(`/workspace-${companyId}`)
                    .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                      action: "update",
                      session: whatsapp
                    });
                } catch { }

                await releaseWbotLock(id);
                removeWbot(id, false);
                return;
              }

              // Restart required: reconectar com delay MAIOR após QR scan (erro 515)
              // Este erro é NORMAL após escanear QR code - o WhatsApp reinicia a conexão
              // IMPORTANTE: NÃO deletar arquivos de sessão! O pareamento é válido.
              // Baileys v7 usa nomes como creds-HASH.json, não creds.json
              if (isRestartRequired) {
                // SEMPRE limpar flag primeiro para garantir que reconexão possa ocorrer
                reconnectingWhatsapps.delete(id);
                
                logger.info(`[wbot] Restart necessário (515) para ${name}. Reconectando em 3s (preservando sessão)...`);
                
                // NÃO limpar arquivos de sessão — o pareamento recém-feito está nos creds
                
                removeWbot(id, false);
                
                // Delay curto (3s) — o pareamento já foi feito, só precisa reconectar
                setTimeout(async () => {
                  try {
                    reconnectingWhatsapps.delete(id);
                    await StartWhatsAppSession(whatsapp, whatsapp.companyId);
                  } catch (err: any) {
                    logger.error(`[wbot] Erro na reconexão (restart 515) para ${name}: ${err?.message}`);
                    reconnectingWhatsapps.delete(id);
                  }
                }, 3000);
                return;
              }

              if (!isLoggedOut) {
                // ========== CIRCUIT BREAKER CHECK ==========
                // Verificar se o circuito está aberto (bloquear reconexões)
                const { open: circuitOpen, remainingMs } = isCircuitBreakerOpen(id);
                if (circuitOpen) {
                  logger.error(
                    `[wbot][CircuitBreaker] CIRCUITO ABERTO para ${name}. ` +
                    `Bloqueando reconexão por mais ${Math.round(remainingMs / 1000)}s. ` +
                    `Erro anterior: ${circuitBreakerMap.get(id)?.lastError}`
                  );
                  removeWbot(id, false);
                  // Notificar frontend que a sessão está com problemas
                  try {
                    io?.of(`/workspace-${companyId}`)
                      .emit("wa-conn-lost", {
                        whatsappId: id,
                        whatsappName: name,
                        statusCode: 'CIRCUIT_BREAKER_OPEN',
                        reason: `Múltiplas falhas de reconexão. Aguardando ${Math.round(remainingMs / 1000)}s antes de tentar novamente.`,
                        qrUrl: `${process.env.FRONTEND_URL || ""}/connections/${id}`
                      });
                  } catch { }
                  return;
                }
                
                // ========== REGISTRAR FALHA NO CIRCUIT BREAKER ==========
                // Se for erro crítico de protocolo, registrar no circuit breaker
                const isCriticalError = isCriticalProtocolError(errorMsg);
                let reconnectDelay = 2000; // Default 2s (acelerado para reconexão rápida)
                
                if (isCriticalError) {
                  const cbResult = recordCircuitBreakerFailure(id, errorMsg);
                  reconnectDelay = cbResult.delayMs;
                  
                  logger.error(
                    `[wbot][RECONNECT] Erro CRÍTICO de protocolo para ${name}: ${errorMsg}. ` +
                    `Circuit Breaker: falha #${circuitBreakerMap.get(id)?.count}, ` +
                    `delay=${reconnectDelay / 1000}s, shouldBlock=${cbResult.shouldBlock}`
                  );
                  
                  // Se circuit breaker abriu, parar reconexões
                  if (cbResult.shouldBlock) {
                    removeWbot(id, false);
                    return;
                  }
                  
                  // ========== CLEANUP SIGNAL PARA ERROS CRÍTICOS ==========
                  // Para xml-not-well-formed e outros erros de protocolo, limpar chaves Signal
                  // antes de reconectar para evitar Bad MAC na próxima sessão
                  try {
                    const SignalCleanupService = require("../services/WbotServices/SignalCleanupService").default;
                    logger.info(`[wbot][SignalCleanup] Limpando chaves Signal para ${name} antes de reconectar...`);
                    const cleanupResult = await SignalCleanupService.cleanupSession(id, companyId);
                    if (cleanupResult.success) {
                      logger.info(`[wbot][SignalCleanup] ✅ ${cleanupResult.deleted} arquivos Signal removidos, ${cleanupResult.preserved} preservados`);
                    } else {
                      logger.warn(`[wbot][SignalCleanup] ⚠️ Falha na limpeza: ${cleanupResult.error}`);
                    }
                  } catch (cleanupErr: any) {
                    logger.warn(`[wbot][SignalCleanup] Erro ao limpar Signal: ${cleanupErr?.message}`);
                  }
                }
                
                // ========== CONTROLE DE RECONEXÃO ==========
                // Verificar se já está reconectando (limpa flags stale > 1min)
                const alreadyReconnecting = getWbotIsReconnecting(id);
                const sessionStillExists = sessions.some(s => s.id === id);
                
                // LOGS DETALHADOS para debug de reconexão
                logger.info(`[wbot][RECONNECT] Iniciando tratamento de desconexão para ${name}. ` +
                  `statusCode=${statusCode}, errorMsg="${errorMsg}", ` +
                  `alreadyReconnecting=${alreadyReconnecting}, sessionStillExists=${sessionStillExists}, ` +
                  `isCriticalError=${isCriticalError}, reconnectDelay=${reconnectDelay / 1000}s`);
                
                if (alreadyReconnecting && sessionStillExists) {
                  // Flag ativa E sessão existe = reconexão genuinamente em andamento
                  logger.warn(`[wbot][RECONNECT] Já existe uma tentativa de reconexão em andamento para ${name}. Ignorando.`);
                  removeWbot(id, false);
                  return;
                }
                
                if (alreadyReconnecting && !sessionStillExists) {
                  // Flag ativa MAS sessão morreu = reconexão anterior falhou silenciosamente
                  logger.warn(`[wbot][RECONNECT] Flag de reconexão ativa para ${name}, mas sessão inexistente. Forçando nova tentativa.`);
                  reconnectingWhatsapps.delete(id);
                }
                
                reconnectingWhatsapps.set(id, Date.now());
                removeWbot(id, false);
                
                logger.info(`[wbot][RECONNECT] Flag de reconexão SETADA para ${name}. Agendando reconexão em ${reconnectDelay / 1000}s...`);
                
                // TIMEOUT DE SEGURANÇA: Limpar flag E disparar reconexão após 60s se sessão não voltou
                setTimeout(async () => {
                  if (reconnectingWhatsapps.get(id) && !sessions.find(s => s.id === id)) {
                    logger.warn(`[wbot][RECONNECT] TIMEOUT DE SEGURANÇA (60s) para ${name} - sessão não voltou. Limpando flag e disparando recovery.`);
                    reconnectingWhatsapps.delete(id);
                    try {
                      const freshWhatsapp = await Whatsapp.findByPk(id);
                      if (freshWhatsapp && freshWhatsapp.status !== "PENDING") {
                        logger.info(`[wbot][RECONNECT] Disparando StartWhatsAppSession após timeout para ${name}`);
                        await StartWhatsAppSession(freshWhatsapp, freshWhatsapp.companyId);
                      } else {
                        logger.warn(`[wbot][RECONNECT] Não foi possível recuperar ${name}: status=${freshWhatsapp?.status}`);
                      }
                    } catch (recoveryErr: any) {
                      logger.error(`[wbot][RECONNECT] Erro no recovery após timeout (60s) para ${name}: ${recoveryErr?.message}`);
                    }
                  } else if (sessions.find(s => s.id === id)) {
                    logger.info(`[wbot][RECONNECT] Timeout de segurança: sessão ${name} já recuperada. OK.`);
                  }
                }, RECONNECT_FLAG_TIMEOUT_MS);
                
                // Reconexão com delay dinâmico (5s padrão, ou mais para erros críticos)
                setTimeout(async () => {
                  logger.info(`[wbot][RECONNECT] Executando reconexão agendada (${reconnectDelay / 1000}s) para ${name}...`);
                  try {
                    // CRÍTICO: Limpar flag ANTES de chamar StartWhatsAppSession
                    // Senão StartWhatsAppSessionUnified vai retornar silenciosamente (getWbotIsReconnecting=true)
                    reconnectingWhatsapps.delete(id);
                    logger.info(`[wbot][RECONNECT] Flag limpa, chamando StartWhatsAppSession para ${name}...`);
                    await StartWhatsAppSession(whatsapp, whatsapp.companyId);
                    logger.info(`[wbot][RECONNECT] StartWhatsAppSession CONCLUÍDO com sucesso para ${name}`);
                  } catch (err: any) {
                    logger.error(`[wbot][RECONNECT] ERRO na StartWhatsAppSession para ${name}: ${err?.message}`);
                    logger.error(`[wbot][RECONNECT] Stack: ${err?.stack}`);
                    // Registrar falha no circuit breaker
                    recordCircuitBreakerFailure(id, err?.message || 'Unknown error');
                  }
                }, reconnectDelay);
              } else {
                // Limpar flag de reconexão - logout, não vai reconectar automaticamente
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
              // Gerar hash de conexão se qrcode estiver vazio
              const currentQrcode = whatsapp.qrcode;
              const connectionHash = currentQrcode && currentQrcode.trim() !== "" 
                ? currentQrcode 
                : `connected_${Date.now()}`;
              
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: connectionHash,
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
              
              // Resetar Circuit Breaker ao conectar com sucesso
              resetCircuitBreaker(id);
              
              // Resetar contador de erros Signal ao conectar com sucesso
              try {
                const { default: SignalErrorHandler } = require("../services/WbotServices/SignalErrorHandler");
                SignalErrorHandler.resetErrorCount(id);
              } catch { /* ignore */ }
              
              logger.info(`[wbot] Conexão estabelecida com sucesso para ${name}. Contadores de conflito, Circuit Breaker e Signal resetados.`);

              // BLINDAGEM: Detectar reconexão com mesmo número e migrar histórico
              try {
                // Usar o número diretamente do socket (wsocket.user.id) ao invés de whatsapp.number
                // pois o objeto whatsapp em memória pode estar desatualizado
                const connNumber = wsocket.type === "md" && (wsocket as WASocket).user?.id
                  ? jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
                  : whatsapp.number;
                
                if (connNumber && connNumber !== "-") {
                  const { onConnectionOpen } = require("../services/WhatsappService/WhatsappConnectionGuardService");
                  const migrationResult = await onConnectionOpen(whatsapp.id, companyId, connNumber);
                  if (migrationResult.ticketsMigrated > 0) {
                    logger.warn(
                      `[wbot] BLINDAGEM: Migrados ${migrationResult.ticketsMigrated} tickets ` +
                      `(de conexões [${migrationResult.oldWhatsappIds.join(",")}]) para #${whatsapp.id} (${connNumber})`
                    );
                  } else {
                    logger.info(`[wbot] BLINDAGEM: Nenhum ticket para migrar para #${whatsapp.id} (${connNumber})`);
                  }
                } else {
                  logger.warn(`[wbot] BLINDAGEM: Número vazio ou inválido, migração ignorada para #${whatsapp.id}`);
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
