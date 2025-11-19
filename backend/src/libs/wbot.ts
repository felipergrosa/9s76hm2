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
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
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

// Rastreamento de erros por número de telefone
// Estrutura: Map<phoneNumber, { count: number, lastError: Date, errors: string[] }>
const phoneNumberErrorTracker = new Map<string, { 
  count: number; 
  lastError: Date; 
  errors: string[];
  whatsappId: number;
}>();

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

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      (async () => {
        const io = getIO();

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) return;

        const { id, name, allowGroup, companyId, number: whatsappNumber } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestWaWebVersion({});
        // Log com timestamp e versão do pacote Baileys instalado
        try {
          // Evita erro de tipo em TS usando require dinâmico
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

        // Verificar se já existe socket para este whatsappId ANTES de criar novo
        const existingSockets = sessions.filter(s => s.id === whatsapp.id);
        if (existingSockets.length > 0) {
          logger.warn(`[wbot][DEBUG] ⚠️ JÁ EXISTEM ${existingSockets.length} socket(s) ativo(s) para whatsappId=${whatsapp.id}`);
          logger.warn(`[wbot][DEBUG] Limpando sockets anteriores para evitar múltiplas conexões...`);
          
          // Limpar todos os sockets anteriores
          for (const existingSocket of existingSockets) {
            try {
              const socketId = existingSocket.id;
              logger.info(`[wbot][DEBUG] Removendo socket existente com id=${socketId}`);
              await removeWbot(socketId!, false);
              logger.info(`[wbot][DEBUG] ✅ Socket ${socketId} removido`);
            } catch (err: any) {
              logger.error(`[wbot][DEBUG] ❌ Erro ao remover socket existente: ${err?.message}`);
            }
          }
          
          // Aguardar um pouco para garantir limpeza
          await new Promise(resolve => setTimeout(resolve, 1000));
          logger.info(`[wbot][DEBUG] ✅ Todos os sockets anteriores foram removidos`);
        }
        
        let wsocket: Session = null;
        const { state, saveCreds } = await useMultiFileAuthState(whatsapp);
        
        // Função helper para obter o número de telefone atual
        const getPhoneNumber = (): string => {
          // Tentar obter do socket conectado primeiro
          if (wsocket?.user?.id) {
            return wsocket.user.id.split("@")[0];
          }
          // Tentar obter das credenciais salvas
          if (state?.creds?.me?.id) {
            return state.creds.me.id.split("@")[0];
          }
          // Usar o número do banco de dados
          return whatsappNumber || "N/A";
        };
        
        // Função helper para registrar erros por número
        const trackPhoneNumberError = (errorType: string, errorMessage: string) => {
          const phoneNumber = getPhoneNumber();
          if (phoneNumber === "N/A") return null;
          
          const existing = phoneNumberErrorTracker.get(phoneNumber) || {
            count: 0,
            lastError: new Date(),
            errors: [],
            whatsappId: id
          };
          
          existing.count += 1;
          existing.lastError = new Date();
          existing.errors.push(`${errorType}: ${errorMessage}`);
          existing.whatsappId = id;
          
          // Manter apenas os últimos 10 erros
          if (existing.errors.length > 10) {
            existing.errors = existing.errors.slice(-10);
          }
          
          phoneNumberErrorTracker.set(phoneNumber, existing);
          
          // Log específico se número tem histórico de problemas
          if (existing.count >= 3) {
            logger.warn(`[wbot] ⚠️ ATENÇÃO: Número ${phoneNumber} tem ${existing.count} erros registrados. Último erro: ${errorType}`);
            logger.warn(`[wbot] ⚠️ Este número pode estar com problemas específicos no WhatsApp.`);
            logger.warn(`[wbot] ⚠️ Recomendações:`);
            logger.warn(`[wbot] ⚠️ 1. Verificar se o dispositivo está conectado no WhatsApp Mobile`);
            logger.warn(`[wbot] ⚠️ 2. Verificar se o dispositivo não foi removido manualmente`);
            logger.warn(`[wbot] ⚠️ 3. Tentar desconectar e reconectar o dispositivo no WhatsApp`);
            logger.warn(`[wbot] ⚠️ 4. Verificar histórico de erros: ${existing.errors.slice(-3).join("; ")}`);
          }
          
          return existing;
        };

        // Log detalhado sobre estado das credenciais antes de criar socket
        try {
          const hasMeId = !!state.creds.me?.id;
          const isRegistered = state.creds.registered || false;
          const meId = state.creds.me?.id || 'N/A';
          
          logger.info(`[wbot] ============================================`);
          logger.info(`[wbot] Estado das Credenciais para whatsappId=${whatsapp.id}:`);
          logger.info(`[wbot] ============================================`);
          logger.info(`[wbot] - Tem MeId: ${hasMeId} ${hasMeId ? '(✅ Credenciais válidas)' : '(❌ Sem credenciais)'}`);
          logger.info(`[wbot] - MeId: ${meId}`);
          logger.info(`[wbot] - Registrado: ${isRegistered} ${isRegistered ? '(✅)' : '(❌)'}`);
          logger.info(`[wbot] - Vai gerar QR: ${!hasMeId} ${!hasMeId ? '(⚠️ QR code será necessário)' : '(✅ Usando credenciais salvas)'}`);
          logger.info(`[wbot] ============================================`);
          
          // Se não tem credenciais, avisar que QR code será necessário
          if (!hasMeId) {
            logger.warn(`[wbot] ⚠️ ATENÇÃO: Sem credenciais válidas. QR code será gerado.`);
            logger.warn(`[wbot] ⚠️ AÇÃO NECESSÁRIA: Escanear QR code quando aparecer.`);
          }
        } catch (err: any) {
          logger.error(`[wbot] ❌ Erro ao verificar estado das credenciais: ${err?.message}`);
          logger.error(`[wbot] Stack: ${err?.stack}`);
        }

        wsocket = makeWASocket({
          version,
          logger: loggerBaileys,
          printQRInTerminal: false,
          // auth: state as AuthenticationState,
          auth: {
            creds: state.creds,
            /** caching makes the store faster to send/recv messages */
            keys: makeCacheableSignalKeyStore(state.keys, logger),
          },
          generateHighQualityLinkPreview: true,
          linkPreviewImageThumbnailWidth: 192,
          // shouldIgnoreJid: jid => isJidBroadcast(jid),

          shouldIgnoreJid: (jid) => {
            //   // const isGroupJid = !allowGroup && isJidGroup(jid)
            return isJidBroadcast(jid) || (!allowGroup && isJidGroup(jid)) //|| jid.includes('newsletter')
          },
          browser: Browsers.appropriate("Desktop"),
          // Browser config padrão do Baileys para evitar fingerprints suspeitos
          // Usar "Desktop" garante compatibilidade com Multi-Device
          defaultQueryTimeoutMs: undefined,
          msgRetryCounterCache,
          // Habilitado: marcar como online ao conectar pode ajudar a manter conexão estável
          // Evolution API e outras implementações bem-sucedidas usam isso
          markOnlineOnConnect: true,
          retryRequestDelayMs: 500,
          maxMsgRetryCount: 5,
          emitOwnEvents: true,
          // DESABILITADO: fireInitQueries pode causar device_removed ao fazer muitas queries iniciais
          // O WhatsApp pode detectar isso como atividade suspeita e desconectar após ~60 segundos
          // Deixar que o Baileys sincronize naturalmente através dos eventos
          fireInitQueries: false,
          transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
          connectTimeoutMs: 25_000,
          // HABILITADO: Keepalive nativo do Baileys a cada 45 segundos (antes do timeout de 60s)
          // Isso complementa o keepalive manual que implementamos
          // Valor menor que 60 segundos evita desconexão por inatividade
          keepAliveIntervalMs: 45_000,
          getMessage: msgDB.get,
        });

        // Store em memória desabilitada nesta versão; usamos snapshot/persistência via messaging-history.set
        setTimeout(async () => {
          const wpp = await Whatsapp.findByPk(whatsapp.id);
          // console.log("Status:::::",wpp.status)
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

            await wpp.update({
              statusImportMessages
            });
            wsocket.ev.on("messaging-history.set", async (messageSet: any) => {
              //if(messageSet.isLatest){

              const statusImportMessages = new Date().getTime();

              await wpp.update({
                statusImportMessages
              });
              // Persistir snapshot de contatos e chats (melhora listagem no modal de import)
              try {
                const { contacts: snapContacts, chats: snapChats } = messageSet || {};
                if ((Array.isArray(snapContacts) && snapContacts.length) || (Array.isArray(snapChats) && snapChats.length)) {
                  await createOrUpdateBaileysService({
                    whatsappId: whatsapp.id,
                    contacts: Array.isArray(snapContacts) ? snapContacts : undefined,
                    chats: Array.isArray(snapChats) ? snapChats : undefined
                  });
                  logger.info(`[wbot] messaging-history.set snapshot persisted: contacts=${Array.isArray(snapContacts) ? snapContacts.length : 0}, chats=${Array.isArray(snapChats) ? snapChats.length : 0}`);
                }
              } catch (e: any) {
                logger.warn(`[wbot] falha ao persistir snapshot de contacts/chats: ${e?.message}`);
              }
              const whatsappId = whatsapp.id;
              let filteredMessages = messageSet.messages
              let filteredDateMessages = []
              filteredMessages.forEach(msg => {
                const timestampMsg = Math.floor(msg.messageTimestamp["low"] * 1000)
                if (isValidMsg(msg) && dateOldLimit < timestampMsg && dateRecentLimit > timestampMsg) {
                  if (msg.key?.remoteJid.split("@")[1] != "g.us") {
                    addLogs({
                      fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`, text: `Adicionando mensagem para pos processamento:
  Não é Mensagem de GRUPO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  Data e hora da mensagem: ${moment(timestampMsg).format("DD/MM/YYYY HH:mm:ss")}
  Contato da Mensagem : ${msg.key?.remoteJid}
  Tipo da mensagem : ${getTypeMessage(msg)}
  
  `})
                    filteredDateMessages.push(msg)
                  } else {
                    if (wpp?.importOldMessagesGroups) {
                      addLogs({
                        fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`, text: `Adicionando mensagem para pos processamento:
  Mensagem de GRUPO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  Data e hora da mensagem: ${moment(timestampMsg).format("DD/MM/YYYY HH:mm:ss")}
  Contato da Mensagem : ${msg.key?.remoteJid}
  Tipo da mensagem : ${getTypeMessage(msg)}
  
  `})
                      filteredDateMessages.push(msg)
                    }
                  }
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




                io.of(`/workspace-${companyId}`)
                  .emit(`importMessages-${wpp.companyId}`, {
                    action: "update",
                    status: { this: -1, all: -1 }
                  });



                io.of(`/workspace-${companyId}`)
                  .emit(`company-${companyId}-whatsappSession`, {
                    action: "update",
                    session: wpp
                  });
                //console.log(JSON.stringify(wpp, null, 2));
              }, 500);

              setTimeout(async () => {


                const wpp = await Whatsapp.findByPk(whatsappId);

                if (wpp?.importOldMessages) {
                  let isTimeStamp = !isNaN(
                    new Date(Math.floor(parseInt(wpp?.statusImportMessages))).getTime()
                  );

                  if (isTimeStamp) {
                    const ultimoStatus = new Date(
                      Math.floor(parseInt(wpp?.statusImportMessages))
                    ).getTime();
                    const dataLimite = +add(ultimoStatus, { seconds: +45 }).getTime();

                    if (dataLimite < new Date().getTime()) {
                      //console.log("Pronto para come?ar")
                      ImportWhatsAppMessageService(wpp.id)
                      wpp.update({
                        statusImportMessages: "Running"
                      })

                    } else {
                      //console.log("Aguardando inicio")
                    }
                  }
                }
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${companyId}-whatsappSession`, {
                    action: "update",
                    session: wpp
                  });
              }, 1000 * 45);

            });
          }

        }, 2500);




        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            const elapsed = (wsocket as any)?._connectionOpenTime 
              ? ((Date.now() - (wsocket as any)._connectionOpenTime) / 1000).toFixed(2)
              : 'N/A';
            
            logger.info(
              `Socket  ${name} Connection Update ${connection || ""} ${lastDisconnect ? lastDisconnect.error.message : ""} [${elapsed}s]`
            );
            
            // Logar TODOS os eventos de connection.update nos primeiros 60 segundos
            if ((wsocket as any)?._connectionOpenTime) {
              const timeSinceOpen = Date.now() - (wsocket as any)._connectionOpenTime;
              if (timeSinceOpen < 70000) { // Primeiros 70 segundos
                logger.debug(`[wbot][EVENT] ${(timeSinceOpen / 1000).toFixed(2)}s - connection.update: ${connection || 'undefined'}`);
                logger.debug(`[wbot][EVENT] - lastDisconnect: ${lastDisconnect ? 'present' : 'null'}`);
                if (lastDisconnect) {
                  logger.debug(`[wbot][EVENT] - error: ${lastDisconnect.error?.message || 'no message'}`);
                }
              }
            }

            if (connection === "close") {
              // Limpar connectingMap imediatamente ao detectar desconexão
              // Isso evita bloqueios caso erro ocorra durante fase de QR code ou conexão
              try {
                const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                clearConnectingMap(whatsapp.id);
                logger.debug(`[wbot] Mapa de conexões limpo imediatamente após desconexão para whatsappId=${whatsapp.id}`);
              } catch (err: any) {
                logger.warn(`[wbot] Erro ao limpar mapa de conexões após desconexão: ${err?.message}`);
              }
              
              // Log completo do erro de desconexão para diagnóstico
              const error = lastDisconnect?.error as Boom;
              const statusCode = error?.output?.statusCode;
              const errorData = error?.data;
              const errorMessage = error?.message || error?.output?.payload?.message || "Unknown error";

              // Log temporal: calcular tempo desde conexão aberta
              const disconnectTime = Date.now();
              const connectionOpenTime = (wsocket as any)?._connectionOpenTime;
              const timeSinceOpen = connectionOpenTime ? (disconnectTime - connectionOpenTime) / 1000 : null;
              
              // Obter número do WhatsApp para logs
              const phoneNumber = getPhoneNumber();
              
              // Log detalhado do erro completo
              logger.error(`[wbot] DESCONEXÃO DETECTADA para whatsappId=${whatsapp.id} (Número: ${phoneNumber}):`);
              logger.error(`[wbot] - Tempo desde conexão aberta: ${timeSinceOpen ? `${timeSinceOpen.toFixed(2)} segundos` : 'N/A'}`);
              logger.error(`[wbot] - Timestamp desconexão: ${new Date(disconnectTime).toISOString()}`);
              logger.error(`[wbot] - Status Code: ${statusCode || "N/A"}`);
              logger.error(`[wbot] - Mensagem: ${errorMessage}`);
              logger.error(`[wbot] - Error Data: ${JSON.stringify(errorData, null, 2)}`);
              
              // Registrar erro por número para rastreamento
              if (statusCode) {
                trackPhoneNumberError(`Status ${statusCode}`, errorMessage);
              }
              
              // Log do erro completo se existir
              if (error) {
                try {
                  logger.error(`[wbot] - Error completo: ${JSON.stringify({
                    statusCode: error.output?.statusCode,
                    error: error.output?.payload?.error,
                    message: error.output?.payload?.message,
                    data: error.data,
                    output: error.output,
                    isBoom: error.isBoom,
                    isServer: error.isServer
                  }, null, 2)}`);
                } catch (e: any) {
                  logger.error(`[wbot] - Erro ao serializar error completo: ${e?.message}`);
                  logger.error(`[wbot] - Error raw: ${error.toString()}`);
                }
              }
              
              // Log completo do lastDisconnect
              try {
                logger.error(`[wbot] - lastDisconnect completo: ${JSON.stringify(lastDisconnect, null, 2)}`);
              } catch (e: any) {
                logger.error(`[wbot] - Erro ao serializar lastDisconnect: ${e?.message}`);
              }
              
              // Log original mantido para compatibilidade
              console.log("DESCONECTOU", JSON.stringify(lastDisconnect, null, 2))
              logger.info(
                `Socket  ${name} Connection Update ${connection || ""} ${errorMessage}`
              );
              
              // Verificar se é erro 401 (device_removed) com log detalhado
              let isDeviceRemoved = false;
              if (statusCode === 401) {
                logger.warn(`[wbot] Erro 401 detectado para whatsappId=${whatsapp.id}. Verificando se é device_removed...`);
                logger.warn(`[wbot] - errorData tipo: ${typeof errorData}`);
                logger.warn(`[wbot] - errorData: ${JSON.stringify(errorData, null, 2)}`);
                
                if (errorData && typeof errorData === 'object' && 'content' in errorData) {
                  const content = errorData.content;
                  logger.warn(`[wbot] - content tipo: ${Array.isArray(content) ? 'array' : typeof content}`);
                  logger.warn(`[wbot] - content: ${JSON.stringify(content, null, 2)}`);
                  
                  if (Array.isArray(content)) {
                    const conflictItems = content.filter((item: any) => 
                      item?.tag === 'conflict' && item?.attrs?.type === 'device_removed'
                    );
                    logger.warn(`[wbot] - Conflict items encontrados: ${conflictItems.length}`);
                    if (conflictItems.length > 0) {
                      logger.warn(`[wbot] - Conflict items: ${JSON.stringify(conflictItems, null, 2)}`);
                    }
                    
                    isDeviceRemoved = conflictItems.length > 0;
                  }
                } else {
                  // Verificar também no output.payload se não encontrou em data
                  const payload = error?.output?.payload;
                  if (payload) {
                    logger.warn(`[wbot] - Verificando output.payload: ${JSON.stringify(payload, null, 2)}`);
                  }
                  
                  // Verificar se a mensagem indica device_removed
                  if (errorMessage && errorMessage.toLowerCase().includes('device_removed')) {
                    logger.warn(`[wbot] - Mensagem contém 'device_removed': ${errorMessage}`);
                    isDeviceRemoved = true;
                  }
                }
              }
              
              // Verificar estado das credenciais antes de tratar erro
              const hasValidCreds = !!state?.creds?.me?.id;
              const credsRegistered = state?.creds?.registered || false;
              
              // Verificar se é erro 428 (Connection Terminated / Precondition Required)
              // Este erro geralmente indica credenciais inválidas ou ausentes
              if (statusCode === 428) {
                const phoneNumber = getPhoneNumber();
                const errorTrack = trackPhoneNumberError(`Connection Terminated (428)`, errorMessage);
                
                logger.warn(`[wbot] ============================================`);
                logger.warn(`[wbot] Erro 428 (Connection Terminated) para whatsappId=${whatsapp.id} (Número: ${phoneNumber})`);
                logger.warn(`[wbot] ============================================`);
                if (errorTrack && errorTrack.count >= 3) {
                  logger.warn(`[wbot] ⚠️ ALERTA: Este número (${phoneNumber}) já teve ${errorTrack.count} erros 428.`);
                  logger.warn(`[wbot] ⚠️ Isso pode indicar um problema específico com as credenciais deste número.`);
                }
                logger.warn(`[wbot] Status Code: 428`);
                logger.warn(`[wbot] Mensagem: ${errorMessage}`);
                logger.warn(`[wbot] Tem credenciais válidas (MeId): ${hasValidCreds}`);
                logger.warn(`[wbot] Credenciais registradas: ${credsRegistered}`);
                logger.warn(`[wbot] ============================================`);
                
                // Se não tem credenciais válidas, limpar sessão completamente e iniciar nova para gerar QR code
                if (!hasValidCreds) {
                  logger.warn(`[wbot] ⚠️ Sem credenciais válidas. Limpando sessão e iniciando nova para gerar QR code.`);
                  logger.warn(`[wbot] ⚠️ Isso garantirá que um novo QR code seja gerado.`);
                  
                  // Limpar sessão completamente (incluindo credenciais do filesystem)
                  await whatsapp.update({ status: "PENDING", session: "" });
                  await DeleteBaileysService(whatsapp.id);
                  await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                  
                  // Remover adapter do cache do WhatsAppFactory
                  try {
                    const { WhatsAppFactory } = require("./whatsapp/WhatsAppFactory");
                    WhatsAppFactory.removeAdapter(whatsapp.id);
                  } catch (err: any) {
                    logger.warn(`[wbot] Erro ao remover adapter do cache: ${err?.message}`);
                  }
                  
                  // Remover sessão em filesystem se existir
                  try {
                    const baseDir = path.resolve(
                      process.cwd(),
                      process.env.SESSIONS_DIR || "private/sessions",
                      String(whatsapp.companyId || "0"),
                      String(whatsapp.id)
                    );
                    await fs.promises.rm(baseDir, { recursive: true, force: true });
                    logger.info(`[wbot] Diretório de sessão removido: ${baseDir}`);
                  } catch (err: any) {
                    logger.warn(`[wbot] Erro ao remover diretório de sessão: ${err?.message}`);
                  }
                  
                  removeWbot(id, false);
                  
                  // Resetar contador de tentativas de QR code
                  retriesQrCodeMap.delete(id);
                  
                  // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                  try {
                    const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                    clearConnectingMap(whatsapp.id);
                    logger.info(`[wbot] Mapa de conexões limpo antes de agendar nova sessão após erro 428 (sem credenciais) para whatsappId=${whatsapp.id}`);
                  } catch (err: any) {
                    logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                  }
                  
                  // Notificar frontend
                  io.of(`/workspace-${companyId}`)
                    .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                      action: "update",
                      session: whatsapp
                    });
                  
                  // Iniciar nova sessão automaticamente após delay (para gerar QR code)
                  logger.info(`[wbot] Iniciando nova sessão em 3 segundos para gerar QR code para whatsappId=${whatsapp.id}...`);
                  setTimeout(() => {
                    const { StartWhatsAppSession } = require("../services/WbotServices/StartWhatsAppSession");
                    StartWhatsAppSession(whatsapp, whatsapp.companyId).catch((err: any) => {
                      logger.error(`[wbot] Erro ao iniciar nova sessão para gerar QR code: ${err?.message}`);
                    });
                  }, 3000); // Aguardar 3 segundos antes de iniciar nova sessão
                  
                  return; // Não continuar para outros tratamentos
                }
                
                // Se tem credenciais mas ainda recebeu 428, pode ser problema temporário
                // Tentar reconectar com delay maior (30 segundos)
                logger.warn(`[wbot] Tem credenciais válidas, mas recebeu 428. Reconectando em 30 segundos...`);
                
                try {
                  await saveCreds();
                  logger.info(`[wbot] Credenciais salvas antes de reconectar após erro 428 para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao salvar credenciais antes de reconectar: ${err?.message}`);
                }
                
                await whatsapp.update({ status: "OPENING", session: "" });
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                removeWbot(id, false);
                
                // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                try {
                  const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                  clearConnectingMap(whatsapp.id);
                  logger.info(`[wbot] Mapa de conexões limpo antes de agendar reconexão após erro 428 para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                }
                
                // Delay maior para erro 428 (30 segundos) - evitar reconexões muito rápidas
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  30000
                );
                
                return; // Não continuar para outros tratamentos
              }
              
              // Verificar se é erro 515 (restart required)
              const isRestartRequired = statusCode === 515;
              
              // Tratamento específico para erro 515 (restart required)
              // Este erro NÃO deve limpar credenciais, apenas reconectar com delay maior
              if (isRestartRequired) {
                const phoneNumber = getPhoneNumber();
                trackPhoneNumberError(`Restart Required (515)`, errorMessage);
                logger.warn(`[wbot] Erro 515 (restart required) para whatsappId=${whatsapp.id} (Número: ${phoneNumber}). Reconectando em 15 segundos (SEM limpar credenciais).`);
                
                // Salvar credenciais antes de reconectar
                try {
                  await saveCreds();
                  logger.info(`[wbot] Credenciais salvas antes de reconectar após erro 515 para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao salvar credenciais antes de reconectar: ${err?.message}`);
                }
                
                await whatsapp.update({ status: "OPENING", session: "" });
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                removeWbot(id, false);
                
                // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                try {
                  const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                  clearConnectingMap(whatsapp.id);
                  logger.info(`[wbot] Mapa de conexões limpo antes de agendar reconexão após erro 515 para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                }
                
                // Delay maior para erro 515 (15 segundos) para evitar conflito
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  15000
                );
                return; // Não continuar para outros tratamentos
              }
              
              if (statusCode === 403 || isDeviceRemoved) {
                const phoneNumber = getPhoneNumber();
                const errorTrack = trackPhoneNumberError(`device_removed (${statusCode})`, errorMessage);
                
                logger.error(`[wbot] ============================================`);
                logger.error(`[wbot] ERRO CRÍTICO: ${statusCode} (${isDeviceRemoved ? 'device_removed' : 'forbidden'}) para whatsappId=${whatsapp.id} (Número: ${phoneNumber})`);
                logger.error(`[wbot] ============================================`);
                if (errorTrack && errorTrack.count >= 3) {
                  logger.error(`[wbot] ⚠️ ALERTA: Este número (${phoneNumber}) já teve ${errorTrack.count} erros de desconexão.`);
                  logger.error(`[wbot] ⚠️ Isso indica um problema específico com este número WhatsApp.`);
                  logger.error(`[wbot] ⚠️ Verifique se o dispositivo está conectado no WhatsApp Mobile e se não foi removido manualmente.`);
                }
                logger.error(`[wbot] Limpando sessão e removendo credenciais...`);
                logger.error(`[wbot] Status Code: ${statusCode}`);
                logger.error(`[wbot] Is Device Removed: ${isDeviceRemoved}`);
                logger.error(`[wbot] Error Message: ${errorMessage}`);
                logger.error(`[wbot] Error Data: ${JSON.stringify(errorData, null, 2)}`);
                logger.error(`[wbot] ============================================`);
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
                  logger.info(`[wbot] Diretório de sessão removido: ${baseDir}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao remover diretório de sessão: ${err?.message}`);
                }
                // Remover adapter do cache do WhatsAppFactory
                try {
                  const { WhatsAppFactory } = require("./whatsapp/WhatsAppFactory");
                  WhatsAppFactory.removeAdapter(whatsapp.id);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao remover adapter do cache: ${err?.message}`);
                }
                // Resetar contador de tentativas de QR code
                retriesQrCodeMap.delete(id);
                
                // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                try {
                  const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                  clearConnectingMap(whatsapp.id);
                  logger.info(`[wbot] Mapa de conexões limpo antes de agendar nova sessão após device_removed para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                }
                
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                removeWbot(id, false);
                
                // Iniciar nova sessão automaticamente após delay para gerar QR code
                // Como credenciais foram removidas, o Baileys gerará QR code automaticamente
                logger.info(`[wbot] Iniciando nova sessão em 3 segundos para gerar QR code após device_removed para whatsappId=${whatsapp.id}...`);
                setTimeout(() => {
                  const { StartWhatsAppSession } = require("../services/WbotServices/StartWhatsAppSession");
                  StartWhatsAppSession(whatsapp, whatsapp.companyId).catch((err: any) => {
                    logger.error(`[wbot] Erro ao iniciar nova sessão para gerar QR code após device_removed: ${err?.message}`);
                  });
                }, 3000); // Aguardar 3 segundos antes de iniciar nova sessão
                
                return; // Não continuar para outros tratamentos
              }
              
              if (
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut
              ) {
                // Salvar credenciais antes de reconectar para outros erros
                try {
                  await saveCreds();
                  logger.debug(`[wbot] Credenciais salvas antes de reconectar após desconexão para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao salvar credenciais antes de reconectar: ${err?.message}`);
                }
                
                removeWbot(id, false);
                
                // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                try {
                  const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                  clearConnectingMap(whatsapp.id);
                  logger.debug(`[wbot] Mapa de conexões limpo antes de agendar reconexão após desconexão para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                }
                
                // Delay maior para evitar reconexões muito rápidas (5 segundos)
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  5000
                );
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
                } catch {}
                io.of(`/workspace-${companyId}`)
                  .emit(`company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                removeWbot(id, false);
                
                // Limpar connectingMap antes de agendar reconexão para evitar bloqueio
                try {
                  const { clearConnectingMap } = require("../services/WbotServices/StartWhatsAppSession");
                  clearConnectingMap(whatsapp.id);
                  logger.debug(`[wbot] Mapa de conexões limpo antes de agendar reconexão após logout para whatsappId=${whatsapp.id}`);
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao limpar mapa de conexões: ${err?.message}`);
                }
                
                // Delay maior após logout (10 segundos)
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  10000
                );
              }
            }

            if (connection === "open") {
              // Log temporal de quando conexão abriu
              const connectionOpenTime = Date.now();
              
              // Verificar estado das credenciais quando conexão abre
              const hasMeId = !!state?.creds?.me?.id;
              const credsRegistered = state?.creds?.registered || false;
              
              logger.info(`[wbot][TIMING] Conexão aberta para whatsappId=${whatsapp.id} em ${new Date(connectionOpenTime).toISOString()}`);
              logger.info(`[wbot][TIMING] Estado das credenciais: MeId=${hasMeId ? '✅' : '❌'}, Registered=${credsRegistered ? '✅' : '❌'}`);
              
              // Log detalhado sobre registro do dispositivo
              try {
                const userJid = (wsocket as WASocket).user?.id;
                const socketType = (wsocket as any).type || "unknown";
                const platform = (wsocket as any).platform || "unknown";
                const isRegistered = (wsocket as any).user?.registered !== undefined ? (wsocket as any).user?.registered : null;
                const userObject = (wsocket as any).user || {};
                
                logger.info(`[wbot] ============================================`);
                logger.info(`[wbot] REGISTRO DO DISPOSITIVO para whatsappId=${whatsapp.id}:`);
                logger.info(`[wbot] ============================================`);
                logger.info(`[wbot] - User JID: ${userJid || 'NULL/UNDEFINED'}`);
                logger.info(`[wbot] - Tipo de socket: ${socketType} (md = Multi-Device, legacy = antigo)`);
                logger.info(`[wbot] - Plataforma: ${platform}`);
                logger.info(`[wbot] - Registrado (user.registered): ${isRegistered} ${isRegistered === null ? '(não definido)' : isRegistered ? '(✅ SIM)' : '(❌ NÃO)'}`);
                // Log detalhado do browser config
                const browserConfig = (wsocket as any).browser || Browsers.appropriate("Desktop");
                logger.info(`[wbot] - Browser config: ${JSON.stringify(browserConfig, null, 2)}`);
                logger.info(`[wbot] - Browser config type: ${typeof browserConfig}`);
                logger.info(`[wbot] - User object completo: ${JSON.stringify(userObject, null, 2)}`);
                
                // Verificar versão do Baileys
                try {
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  const baileysPkg = require("@whiskeysockets/baileys/package.json");
                  logger.info(`[wbot] - Baileys version: ${baileysPkg?.version || 'unknown'}`);
                } catch (e) {
                  logger.warn(`[wbot] - Não foi possível ler versão do Baileys: ${(e as Error).message}`);
                }
                
                // Verificar se é tipo MD (Multi-Device) - necessário para aparecer como dispositivo vinculado
                if (socketType === "md") {
                  logger.info(`[wbot] ✅ Tipo MD detectado - dispositivo DEVE aparecer na lista de dispositivos vinculados`);
                  if (isRegistered === false) {
                    logger.warn(`[wbot] ⚠️ ATENÇÃO: Tipo MD mas registered=false - WhatsApp pode não ter vinculado o dispositivo`);
                    logger.warn(`[wbot] ⚠️ O dispositivo pode não aparecer na lista de dispositivos vinculados`);
                  } else if (isRegistered === true) {
                    logger.info(`[wbot] ✅ Tipo MD e registered=true - dispositivo deve aparecer na lista`);
                  }
                } else if (socketType === "legacy") {
                  logger.warn(`[wbot] ⚠️ Tipo LEGACY detectado - dispositivo pode NÃO aparecer na lista de dispositivos vinculados`);
                  logger.warn(`[wbot] ⚠️ Recomendado: reconectar para obter tipo MD`);
                } else {
                  logger.warn(`[wbot] ⚠️ Tipo desconhecido: ${socketType}`);
                }
                logger.info(`[wbot] ============================================`);
              } catch (err: any) {
                logger.error(`[wbot] ❌ Erro ao logar informações do dispositivo: ${err?.message}`);
                logger.error(`[wbot] Stack: ${err?.stack}`);
              }
              
              // Salvar credenciais imediatamente após conexão abrir
              try {
                await saveCreds();
                logger.info(`[wbot] Credenciais salvas após conexão aberta para whatsappId=${whatsapp.id}`);
              } catch (error: any) {
                logger.error(`[wbot] Erro ao salvar credenciais após conexão: ${error?.message}`);
              }

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

              // DESABILITADO: resyncAppState completo imediato pode causar device_removed
              // O WhatsApp pode detectar isso como atividade suspeita e desconectar
              // Deixar que o Baileys sincronize naturalmente através dos eventos
              // 
              // Se necessário sincronizar labels posteriormente, fazer com delay e apenas labels específicos
              logger.info(`[wbot] Conexão aberta para whatsappId=${whatsapp.id}. ResyncAppState completo desabilitado para evitar device_removed.`);
              
              // Armazenar timestamp de abertura para rastreamento
              (wsocket as any)._connectionOpenTime = connectionOpenTime;
              
              // Marcar que conexão está "aquecendo" (primeiros 5 segundos após abrir)
              // Durante esse período, evitar operações pesadas que possam causar device_removed
              (wsocket as any)._connectionWarmingUp = true;
              setTimeout(() => {
                (wsocket as any)._connectionWarmingUp = false;
                logger.debug(`[wbot] Conexão finalizou período de aquecimento para whatsappId=${whatsapp.id}`);
              }, 5000); // 5 segundos de aquecimento

              // Salvar credenciais periodicamente enquanto conectado (a cada 30 segundos)
              // Isso garante que credenciais estejam sempre atualizadas
              const saveCredsInterval = setInterval(async () => {
                try {
                  if (wsocket && (wsocket as any).user?.id) {
                    await saveCreds();
                    logger.debug(`[wbot] Credenciais salvas periodicamente para whatsappId=${whatsapp.id}`);
                  } else {
                    clearInterval(saveCredsInterval);
                  }
                } catch (err: any) {
                  logger.warn(`[wbot] Erro ao salvar credenciais periodicamente: ${err?.message}`);
                }
              }, 30000); // Salvar a cada 30 segundos

              // Keepalive: Enviar presença periódica para manter conexão ativa
              // O WhatsApp desconecta após ~60 segundos se não houver atividade
              // Enviar presença a cada 30 segundos mantém a conexão viva (mais seguro)
              // IMPORTANTE: Primeiro keepalive após 25 segundos (antes dos 60s)
              
              // Verificar se timers foram criados corretamente
              let keepaliveCount = 0;
              let keepaliveInterval: NodeJS.Timeout | null = null;
              let firstKeepaliveTimeout: NodeJS.Timeout | null = null;
              let safetyKeepaliveTimeout: NodeJS.Timeout | null = null;

              // Monitorar eficácia do keepalive
              const keepaliveStats = {
                sent: 0,
                failed: 0,
                lastSent: null as number | null,
                lastFailed: null as number | null
              };

              // Armazenar referências para limpeza
              const timersRef = {
                interval: null as NodeJS.Timeout | null,
                timeout: null as NodeJS.Timeout | null,
                cleaned: false
              };
              
              // Primeiro keepalive após 25 segundos (antes do timeout de 60s)
              const elapsedMs = Date.now() - connectionOpenTime;
              logger.info(`[wbot][KEEPALIVE] Criando primeiro keepalive timer (executará em ${25000 - elapsedMs}ms para whatsappId=${whatsapp.id}`);
              
              firstKeepaliveTimeout = setTimeout(async () => {
                try {
                  const elapsed = (Date.now() - connectionOpenTime) / 1000;
                  logger.info(`[wbot][KEEPALIVE] ⏰ PRIMEIRO KEEPALIVE DISPARADO após ${elapsed.toFixed(2)}s para whatsappId=${whatsapp.id}`);
                  
                  // Verificar se socket ainda está disponível ANTES de tentar
                  if (!wsocket) {
                    logger.error(`[wbot][KEEPALIVE] ❌ Socket não existe para whatsappId=${whatsapp.id}`);
                    return;
                  }
                  
                  if (!(wsocket as any).user?.id) {
                    logger.error(`[wbot][KEEPALIVE] ❌ User ID não disponível para whatsappId=${whatsapp.id}`);
                    logger.error(`[wbot][KEEPALIVE] Socket type: ${(wsocket as any).type || 'unknown'}`);
                    logger.error(`[wbot][KEEPALIVE] User object: ${JSON.stringify((wsocket as any).user || {}, null, 2)}`);
                    return;
                  }
                  
                  const userJid = (wsocket as WASocket).user.id;
                  logger.info(`[wbot][KEEPALIVE] ✅ Precondições OK: Socket=✅, UserJID=${userJid}`);
                  logger.info(`[wbot][KEEPALIVE] Tentando enviar sendPresenceUpdate("available", "${userJid}")...`);
                  
                  // Verificar se sendPresenceUpdate existe
                  if (typeof wsocket.sendPresenceUpdate !== 'function') {
                    logger.error(`[wbot][KEEPALIVE] ❌ sendPresenceUpdate não é uma função!`);
                    logger.error(`[wbot][KEEPALIVE] wsocket type: ${typeof wsocket}`);
                    logger.error(`[wbot][KEEPALIVE] wsocket methods: ${Object.keys(wsocket).join(', ')}`);
                    return;
                  }
                  
                  // Tentar enviar presença
                  await wsocket.sendPresenceUpdate("available", userJid);
                  keepaliveCount++;
                  logger.info(`[wbot][KEEPALIVE] ✅ Primeiro keepalive #${keepaliveCount} enviado COM SUCESSO para whatsappId=${whatsapp.id} às ${new Date().toISOString()}`);
                  logger.info(`[wbot][KEEPALIVE] Tempo desde conexão: ${((Date.now() - connectionOpenTime) / 1000).toFixed(2)}s`);
                } catch (err: any) {
                  keepaliveStats.failed++;
                  keepaliveStats.lastFailed = Date.now();
                  logger.error(`[wbot][KEEPALIVE] ❌ ERRO ao enviar primeiro keepalive para whatsappId=${whatsapp.id}:`);
                  logger.error(`[wbot][KEEPALIVE] - Mensagem: ${err?.message || 'Unknown error'}`);
                  logger.error(`[wbot][KEEPALIVE] - Stack: ${err?.stack || 'No stack trace'}`);
                  logger.error(`[wbot][KEEPALIVE] - Error type: ${err?.constructor?.name || typeof err}`);
                  logger.error(`[wbot][KEEPALIVE] - Error completo: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
                  logger.error(`[wbot][KEEPALIVE] - Estatísticas: Enviados=${keepaliveStats.sent}, Falhados=${keepaliveStats.failed}`);
                }
              }, 25000); // Primeiro keepalive após 25 segundos
              
              timersRef.timeout = firstKeepaliveTimeout;
              logger.info(`[wbot][KEEPALIVE] ✅ Primeiro keepalive timer criado com ID: ${firstKeepaliveTimeout?.[Symbol.toPrimitive]?.() || 'unknown'}`);
              
              // Keepalive periódico a cada 20 segundos (reduzido de 30s para garantir atividade antes dos 60s)
              logger.info(`[wbot][KEEPALIVE] Criando keepalive interval (a cada 20s) para whatsappId=${whatsapp.id}`);
              
              keepaliveInterval = setInterval(async () => {
                try {
                  const elapsed = (Date.now() - connectionOpenTime) / 1000;
                  logger.info(`[wbot][KEEPALIVE] ⏰ KEEPALIVE INTERVAL DISPARADO após ${elapsed.toFixed(2)}s para whatsappId=${whatsapp.id}`);
                  
                  // Verificar se socket ainda está disponível ANTES de tentar
                  if (!wsocket) {
                    logger.error(`[wbot][KEEPALIVE] ❌ Socket não existe no intervalo para whatsappId=${whatsapp.id}`);
                    clearInterval(keepaliveInterval!);
                    return;
                  }
                  
                  if (!(wsocket as any).user?.id) {
                    logger.error(`[wbot][KEEPALIVE] ❌ User ID não disponível no intervalo para whatsappId=${whatsapp.id}`);
                    logger.error(`[wbot][KEEPALIVE] Socket type: ${(wsocket as any).type || 'unknown'}`);
                    clearInterval(keepaliveInterval!);
                    return;
                  }
                  
                  keepaliveCount++;
                  const userJid = (wsocket as WASocket).user.id;
                  logger.info(`[wbot][KEEPALIVE] ✅ Precondições OK: Socket=✅, UserJID=${userJid}, Count=#${keepaliveCount}`);
                  logger.info(`[wbot][KEEPALIVE] Tentando enviar sendPresenceUpdate("available", "${userJid}")...`);
                  
                  // Verificar se sendPresenceUpdate existe
                  if (typeof wsocket.sendPresenceUpdate !== 'function') {
                    logger.error(`[wbot][KEEPALIVE] ❌ sendPresenceUpdate não é uma função no intervalo!`);
                    clearInterval(keepaliveInterval!);
                    return;
                  }
                  
                  // Tentar enviar presença
                  await wsocket.sendPresenceUpdate("available", userJid);
                  keepaliveStats.sent++;
                  keepaliveStats.lastSent = Date.now();
                  logger.info(`[wbot][KEEPALIVE] ✅ Keepalive #${keepaliveCount} enviado COM SUCESSO para whatsappId=${whatsapp.id} às ${new Date().toISOString()}`);
                  logger.info(`[wbot][KEEPALIVE] Tempo desde conexão: ${elapsed.toFixed(2)}s`);
                } catch (err: any) {
                  keepaliveStats.failed++;
                  keepaliveStats.lastFailed = Date.now();
                  logger.error(`[wbot][KEEPALIVE] ❌ ERRO ao enviar keepalive #${keepaliveCount} para whatsappId=${whatsapp.id}:`);
                  logger.error(`[wbot][KEEPALIVE] - Mensagem: ${err?.message || 'Unknown error'}`);
                  logger.error(`[wbot][KEEPALIVE] - Stack: ${err?.stack || 'No stack trace'}`);
                  logger.error(`[wbot][KEEPALIVE] - Error type: ${err?.constructor?.name || typeof err}`);
                  logger.error(`[wbot][KEEPALIVE] - Error completo: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
                  logger.error(`[wbot][KEEPALIVE] - Estatísticas: Enviados=${keepaliveStats.sent}, Falhados=${keepaliveStats.failed}, Taxa de falha=${((keepaliveStats.failed / (keepaliveStats.sent + keepaliveStats.failed)) * 100).toFixed(1)}%`);
                  
                  // Alerta se taxa de falha está alta
                  const totalAttempts = keepaliveStats.sent + keepaliveStats.failed;
                  if (totalAttempts >= 3 && (keepaliveStats.failed / totalAttempts) > 0.5) {
                    logger.error(`[wbot][KEEPALIVE] 🚨 ALERTA: Taxa de falha do keepalive está alta (>50%) para whatsappId=${whatsapp.id}`);
                    logger.error(`[wbot][KEEPALIVE] 🚨 Isso pode indicar problema grave de conexão - verificar imediatamente!`);
                  }
                  
                  // NÃO limpar intervalo em caso de erro - tentar novamente no próximo ciclo
                  // O erro pode ser temporário (ex: socket em reconexão)
                }
              }, 20000); // A cada 20 segundos (mais seguro, garante atividade antes dos 60s)
              
              timersRef.interval = keepaliveInterval;
              logger.info(`[wbot][KEEPALIVE] ✅ Keepalive interval criado com ID: ${keepaliveInterval?.[Symbol.toPrimitive]?.() || 'unknown'}`);
              
              // Keepalive de segurança adicional aos 50 segundos (antes dos 60s)
              // Isso garante que sempre há atividade antes do timeout
              safetyKeepaliveTimeout = setTimeout(async () => {
                try {
                  const elapsed = (Date.now() - connectionOpenTime) / 1000;
                  logger.info(`[wbot][KEEPALIVE] ⏰ KEEPALIVE DE SEGURANÇA DISPARADO após ${elapsed.toFixed(2)}s para whatsappId=${whatsapp.id}`);
                  
                  if (!wsocket || !(wsocket as any).user?.id) {
                    logger.warn(`[wbot][KEEPALIVE] ⚠️ Keepalive de segurança cancelado: socket não disponível`);
                    return;
                  }
                  
                  keepaliveCount++;
                  const userJid = (wsocket as WASocket).user.id;
                  await wsocket.sendPresenceUpdate("available", userJid);
                  keepaliveStats.sent++;
                  keepaliveStats.lastSent = Date.now();
                  logger.info(`[wbot][KEEPALIVE] ✅ Keepalive de segurança #${keepaliveCount} enviado COM SUCESSO aos ${elapsed.toFixed(2)}s`);
                } catch (err: any) {
                  keepaliveStats.failed++;
                  keepaliveStats.lastFailed = Date.now();
                  logger.error(`[wbot][KEEPALIVE] ❌ ERRO no keepalive de segurança: ${err?.message}`);
                  logger.error(`[wbot][KEEPALIVE] - Estatísticas: Enviados=${keepaliveStats.sent}, Falhados=${keepaliveStats.failed}`);
                }
              }, 50000); // Aos 50 segundos (antes dos 60s)
              
              timersRef.timeout = safetyKeepaliveTimeout;
              logger.info(`[wbot][KEEPALIVE] ✅ Keepalive de segurança agendado para 50s`);
              
              // Health check da conexão a cada 10 segundos (primeiros 70 segundos)
              let activityCount = 0;
              const trackActivity = (activityName: string) => {
                activityCount++;
                const elapsed = (Date.now() - connectionOpenTime) / 1000;
                logger.info(`[wbot][ACTIVITY] #${activityCount} - ${activityName} aos ${elapsed.toFixed(2)}s para whatsappId=${whatsapp.id}`);
              };

              const healthCheckInterval = setInterval(async () => {
                const elapsed = (Date.now() - connectionOpenTime) / 1000;
                if (elapsed > 70) {
                  clearInterval(healthCheckInterval);
                  
                  // Log final de estatísticas do keepalive
                  const successRate = keepaliveStats.sent + keepaliveStats.failed > 0
                    ? ((keepaliveStats.sent / (keepaliveStats.sent + keepaliveStats.failed)) * 100).toFixed(1)
                    : '0';
                  logger.info(`[wbot][HEALTH] ⏱️ Resumo após 70s para whatsappId=${whatsapp.id}:`);
                  logger.info(`[wbot][HEALTH] - Keepalives enviados: ${keepaliveStats.sent}`);
                  logger.info(`[wbot][HEALTH] - Keepalives falhados: ${keepaliveStats.failed}`);
                  logger.info(`[wbot][HEALTH] - Taxa de sucesso: ${successRate}%`);
                  if (keepaliveStats.failed > 0) {
                    logger.warn(`[wbot][HEALTH] ⚠️ ${keepaliveStats.failed} keepalive(s) falharam - pode indicar problema de conexão`);
                  }
                  return;
                }

                const hasUser = !!wsocket?.user?.id;
                const isConnected = wsocket && hasUser;
                const socketType = (wsocket as any)?.type || 'unknown';
                const isRegistered = (wsocket as any)?.user?.registered;
                const timeSinceLastKeepalive = keepaliveStats.lastSent 
                  ? ((Date.now() - keepaliveStats.lastSent) / 1000).toFixed(1)
                  : 'N/A';

                logger.info(`[wbot][HEALTH] ${elapsed.toFixed(1)}s - Socket: ${!!wsocket}, User: ${hasUser}, Type: ${socketType}, Registered: ${isRegistered}`);
                logger.info(`[wbot][HEALTH] - Keepalives enviados: ${keepaliveStats.sent}, Falhados: ${keepaliveStats.failed}, Último há: ${timeSinceLastKeepalive}s`);

                // Alerta se último keepalive foi há mais de 30 segundos e ainda não chegou aos 60s
                if (keepaliveStats.lastSent && elapsed < 60) {
                  const timeSinceLast = (Date.now() - keepaliveStats.lastSent) / 1000;
                  if (timeSinceLast > 30) {
                    logger.warn(`[wbot][HEALTH] ⚠️ Último keepalive foi há ${timeSinceLast.toFixed(1)}s - pode indicar problema!`);
                  }
                }

                if (!isConnected && elapsed < 60) {
                  logger.error(`[wbot][HEALTH] ⚠️ Conexão perdeu antes dos 60s! Tempo: ${elapsed.toFixed(2)}s`);
                }
              }, 10000); // A cada 10 segundos
              
              // Atualizar estatísticas quando keepalive é enviado com sucesso
              const originalSendPresenceUpdate = wsocket.sendPresenceUpdate.bind(wsocket);
              wsocket.sendPresenceUpdate = async (...args: any[]) => {
                try {
                  await originalSendPresenceUpdate(...args);
                  keepaliveStats.sent++;
                  keepaliveStats.lastSent = Date.now();
                } catch (err: any) {
                  keepaliveStats.failed++;
                  keepaliveStats.lastFailed = Date.now();
                  throw err;
                }
              };
              
              // Limpar health check quando desconectar
              wsocket.ev.on("connection.update", (update: any) => {
                if (update.connection === "close") {
                  clearInterval(healthCheckInterval);
                  if (safetyKeepaliveTimeout) {
                    clearTimeout(safetyKeepaliveTimeout);
                    logger.info(`[wbot][KEEPALIVE] ✅ Keepalive de segurança cancelado`);
                  }
                }
              });

              // Limpar intervalos e timeouts quando desconectar
              wsocket.ev.on("connection.update", (update: any) => {
                if (update.connection === "close") {
                  logger.info(`[wbot][KEEPALIVE] 🧹 Limpando keepalive timers para whatsappId=${whatsapp.id}`);
                  
                  // Limpar timers
                  if (keepaliveInterval) {
                    clearInterval(keepaliveInterval);
                    logger.info(`[wbot][KEEPALIVE] ✅ Keepalive interval limpo`);
                    keepaliveInterval = null;
                  }
                  
                  if (firstKeepaliveTimeout) {
                    clearTimeout(firstKeepaliveTimeout);
                    logger.info(`[wbot][KEEPALIVE] ✅ Primeiro keepalive timeout limpo`);
                    firstKeepaliveTimeout = null;
                  }
                  
                  if (safetyKeepaliveTimeout) {
                    clearTimeout(safetyKeepaliveTimeout);
                    logger.info(`[wbot][KEEPALIVE] ✅ Keepalive de segurança timeout limpo`);
                  }
                  
                  clearInterval(saveCredsInterval);
                  timersRef.cleaned = true;
                  
                  logger.info(`[wbot][KEEPALIVE] 🧹 Todos os timers foram limpos para whatsappId=${whatsapp.id}`);
                  logger.info(`[wbot][KEEPALIVE] Total de keepalives enviados: ${keepaliveCount}`);
                }
              });

              resolve(wsocket);
            }

            if (qr !== undefined) {
              const hasMeId = !!state?.creds?.me?.id;
              const isRegistered = state?.creds?.registered || false;
              const retryCount = retriesQrCodeMap.get(id) || 0;
              const qrTimestamp = Date.now();
              
              logger.info(`[wbot] ============================================`);
              logger.info(`[wbot] QR CODE GERADO para whatsappId=${whatsapp.id}:`);
              logger.info(`[wbot] ============================================`);
              logger.info(`[wbot] - Tentativa: ${retryCount + 1}`);
              logger.info(`[wbot] - Tem MeId: ${hasMeId} ${hasMeId ? '(✅)' : '(❌ - PRECISA ESCANEAR QR)'}`);
              logger.info(`[wbot] - Registrado: ${isRegistered} ${isRegistered ? '(✅)' : '(❌)'}`);
              logger.info(`[wbot] - Isso indica que NÃO há credenciais válidas salvas`);
              logger.info(`[wbot] - AÇÃO NECESSÁRIA: Escanear QR code com WhatsApp Mobile`);
              logger.info(`[wbot] - Timestamp: ${new Date(qrTimestamp).toISOString()}`);
              logger.info(`[wbot] - QR Code expira em ~60 segundos`);
              logger.info(`[wbot] ============================================`);
              
              // Armazenar timestamp do QR code para monitoramento
              (wsocket as any)._qrCodeTimestamp = qrTimestamp;
              (wsocket as any)._qrCodeScanned = false;
              
              // Monitorar se QR code foi escaneado (verificar após 5 segundos se credenciais mudaram)
              const qrMonitorInterval = setInterval(() => {
                const elapsed = (Date.now() - qrTimestamp) / 1000;
                const currentHasMeId = !!state?.creds?.me?.id;
                const currentRegistered = state?.creds?.registered || false;
                
                // Se credenciais apareceram, QR foi escaneado
                if (currentHasMeId && !(wsocket as any)._qrCodeScanned) {
                  (wsocket as any)._qrCodeScanned = true;
                  clearInterval(qrMonitorInterval);
                  logger.info(`[wbot] ✅ QR CODE ESCANEADO! Credenciais apareceram aos ${elapsed.toFixed(2)}s para whatsappId=${whatsapp.id}`);
                  logger.info(`[wbot] - MeId: ${state?.creds?.me?.id}`);
                  logger.info(`[wbot] - Registered: ${currentRegistered}`);
                } else if (elapsed > 90 && !(wsocket as any)._qrCodeScanned) {
                  // Se passou 90 segundos e QR não foi escaneado, alertar
                  logger.warn(`[wbot] ⚠️ QR CODE NÃO ESCANEADO após ${elapsed.toFixed(0)}s para whatsappId=${whatsapp.id}`);
                  logger.warn(`[wbot] ⚠️ QR code pode ter expirado. Um novo será gerado automaticamente.`);
                  clearInterval(qrMonitorInterval);
                }
              }, 5000); // Verificar a cada 5 segundos
              
              // Limpar monitor quando desconectar
              wsocket.ev.on("connection.update", (update: any) => {
                if (update.connection === "close" || update.connection === "open") {
                  clearInterval(qrMonitorInterval);
                }
              });
              
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                logger.warn(`[wbot] ⚠️ Máximo de tentativas de QR code excedido (3) para whatsappId=${whatsapp.id}`);
                logger.warn(`[wbot] ⚠️ Parando tentativas. Verifique credenciais manualmente.`);
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
        wsocket.ev.on("creds.update", async (update: any) => {
          // Log quando credenciais são atualizadas (incluindo registered)
          if (update && typeof update === 'object') {
            const registered = update.registered;
            const meId = update.me?.id;
            const elapsed = (wsocket as any)?._connectionOpenTime 
              ? ((Date.now() - (wsocket as any)._connectionOpenTime) / 1000).toFixed(2)
              : 'N/A';
            
            if (registered !== undefined) {
              logger.info(`[wbot][CREDS] ============================================`);
              logger.info(`[wbot][CREDS] ✅ REGISTERED MUDOU para whatsappId=${whatsapp.id}:`);
              logger.info(`[wbot][CREDS] - Registered: ${registered} ${registered ? '(✅ SIM - DISPOSITIVO REGISTRADO!)' : '(❌ NÃO)'}`);
              logger.info(`[wbot][CREDS] - Tempo desde conexão: ${elapsed}s`);
              logger.info(`[wbot][CREDS] - Me ID: ${meId || 'N/A'}`);
              logger.info(`[wbot][CREDS] - Update completo: ${JSON.stringify(update, null, 2)}`);
              logger.info(`[wbot][CREDS] ============================================`);
              
              // Atualizar health check para refletir novo valor de registered
              if ((wsocket as any).user) {
                (wsocket as any).user.registered = registered;
              }
              
              // Se registered mudou para true, marcar que não está mais aguardando
              if (registered === true) {
                (wsocket as any)._waitingForRegistration = false;
                logger.info(`[wbot][CREDS] ✅ Registro completo! _waitingForRegistration=false para whatsappId=${whatsapp.id}`);
              }
            } else if (meId) {
              const elapsed = (wsocket as any)?._connectionOpenTime 
                ? ((Date.now() - (wsocket as any)._connectionOpenTime) / 1000).toFixed(2)
                : 'N/A';
              logger.debug(`[wbot][CREDS] Credenciais atualizadas (registered ainda undefined) para whatsappId=${whatsapp.id} aos ${elapsed}s`);
            }
          }
          await saveCreds();
        });

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
              } catch {}
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
              const eventTime = Date.now();
              const connectionOpenTime = (wsocket as any)?._connectionOpenTime;
              const timeSinceOpen = connectionOpenTime ? ((eventTime - connectionOpenTime) / 1000).toFixed(2) : 'N/A';
              
              logger.info(`[wbot][TIMING] labels.edit recebido ${timeSinceOpen}s após conexão: ${JSON.stringify(payload)}`);
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
            } catch (e:any) {
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
              const eventTime = Date.now();
              const connectionOpenTime = (wsocket as any)?._connectionOpenTime;
              const timeSinceOpen = connectionOpenTime ? ((eventTime - connectionOpenTime) / 1000).toFixed(2) : 'N/A';
              logger.info(`[wbot][TIMING] messaging-history.set recebido ${timeSinceOpen}s após conexão para whatsappId=${whatsapp.id}`);
              
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
                    .map((c: any) => ({ id: String(c?.id || c?.jid || ""), labels: Array.isArray(c?.labels) ? c.labels.map((x:any)=>String(x)) : [] }))
                    .filter((x: any) => x.id && x.labels.length);
                  if (batch.length) {
                    await createOrUpdateBaileysService({ whatsappId: whatsapp.id, chats: batch.map((b:any)=>({ ...b, labelsAbsolute: true })) });
                  }
                } catch (e:any) {
                  logger.warn(`[wbot] persist from messaging-history.set failed: ${e?.message}`);
                }
              }
            } catch (e:any) {
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
                  } catch {}
                }
                const ids: string[] = Array.from(new Set((raw || []).map((x:any)=>String(typeof x === 'object' ? (x.id ?? x.value ?? x) : x))));
                if (!ids.length) continue;
                for (const lid of ids) addChatLabelAssociation(whatsapp.id, jid, lid, true);
                batch.push({ id: jid, labels: ids, labelsAbsolute: true });
              }
              if (batch.length) {
                await createOrUpdateBaileysService({ whatsappId: whatsapp.id, chats: batch as any });
                logger.info(`[wbot] persisted ${batch.length} chat label updates from ${source}`);
              }
            } catch (e:any) {
              logger.warn(`[wbot] handleChatLabelUpdate failed (${source}): ${e?.message}`);
            }
          };

          wsocket.ev.on("chats.upsert" as any, async (payload: any) => handleChatLabelUpdate(payload, 'chats.upsert'));
          wsocket.ev.on("chats.update" as any, async (payload: any) => handleChatLabelUpdate(payload, 'chats.update'));
        } catch (e:any) {
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
