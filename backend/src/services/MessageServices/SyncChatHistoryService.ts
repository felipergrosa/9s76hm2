import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";
import CreateMessageService from "./CreateMessageService";
import { isValidMsg, getTypeMessage, getBodyMessage } from "../WbotServices/wbotMessageListener";
import {
  registerHistoryHandler,
  unregisterHistoryHandler,
  registerFetchRequest,
  startFetchRequest,
  cancelFetchRequest
} from "../../libs/messageHistoryHandler";
import { acquireFetchLock } from "../../libs/fetchHistoryMutex";
import { downloadMediaMessage, getContentType, extractMessageContent, WASocket } from "@whiskeysockets/baileys";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);

// Tipos de mídia que podem ser baixados
const DOWNLOADABLE_MEDIA_TYPES = ["image", "video", "audio", "sticker", "document"];

interface SyncChatHistoryParams {
  ticketId: string | number;
  companyId: number;
  messageCount?: number;
  forceSync?: boolean;
  syncAll?: boolean;
  maxPages?: number;
}

interface SyncResult {
  synced: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Mapeia tipo de mídia Baileys para tipo do banco
 */
const mediaTypeMap: Record<string, string> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  stickerMessage: "sticker",
  documentMessage: "document",
  documentWithCaptionMessage: "document"
};

/**
 * Sincroniza o histórico de mensagens de um chat do WhatsApp
 * Usa fetchMessageHistory do Baileys v7 com proteção de mutex
 */
const SyncChatHistoryService = async ({
  ticketId,
  companyId,
  messageCount = 100,
  forceSync = false,
  syncAll = false,
  maxPages = 5
}: SyncChatHistoryParams): Promise<SyncResult> => {
  const ticket = await Ticket.findByPk(ticketId, {
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" }
    ]
  });

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} não encontrado`);
  }

  const contact = ticket.contact;
  const jid = `${contact.number}@s.whatsapp.net`;

  logger.info(`[SyncChatHistory] Iniciando sync para ticket=${ticketId}, jid=${jid}, messageCount=${messageCount}`);

  // Adquirir lock para evitar múltiplas chamadas concorrentes (usa whatsappId)
  const releaseLock = await acquireFetchLock(ticket.whatsappId, 'SyncChatHistory');

  try {
    const wbot = await getWbot(ticket.whatsappId);
    
    // Registrar handler para receber mensagens
    const fetchId = registerFetchRequest(jid);
    
    let receivedMessages: any[] = [];
    
    const messageHandler = async (messages: any[], metadata: any) => {
      logger.info(`[SyncChatHistory] Handler recebeu ${messages.length} mensagens para ${jid}`);
      receivedMessages.push(...messages);
    };
    
    registerHistoryHandler(jid, messageHandler);

    try {
      // Iniciar Promise que aguarda resposta
      const fetchPromise = startFetchRequest(fetchId, jid, 60000); // 60s timeout
      
      // Executar fetchMessageHistory
      logger.info(`[SyncChatHistory] Chamando fetchMessageHistory para ${jid} (${messageCount} msgs)`);
      await wbot.fetchMessageHistory(messageCount, { remoteJid: jid }, undefined);
      
      // Aguardar resposta via messaging-history.set
      const result = await fetchPromise;
      
      logger.info(`[SyncChatHistory] Fetch completo: ${result.messages.length} mensagens recebidas`);
      
      // Processar mensagens recebidas
      let syncedCount = 0;
      const io = getIO();
      
      for (const msg of result.messages) {
        try {
          // Filtrar placeholders (mensagens sem conteúdo)
          if (!msg?.message) {
            logger.debug(`[SyncChatHistory] Ignorando placeholder: ${msg?.key?.id}`);
            continue;
          }

          // Verificar se já existe no banco
          const existingMsg = await Message.findOne({
            where: {
              wid: msg.key.id,
              companyId
            }
          });

          if (existingMsg && !forceSync) {
            logger.debug(`[SyncChatHistory] Mensagem já existe: ${msg.key.id}`);
            continue;
          }

          // Extrair conteúdo da mensagem
          const messageContent = extractMessageContent(msg.message);
          if (!messageContent) continue;

          const messageType = getContentType(messageContent);
          if (!messageType) continue;

          // Determinar corpo da mensagem
          let body = "";
          let mediaType: string | null = null;
          let mediaUrl: string | null = null;

          if (messageType === "conversation") {
            body = messageContent.conversation || "";
          } else if (messageType === "extendedTextMessage") {
            body = messageContent.extendedTextMessage?.text || "";
          } else if (mediaTypeMap[messageType]) {
            mediaType = mediaTypeMap[messageType];
            const mediaMsg: any = messageContent[messageType];
            body = mediaMsg?.caption || mediaMsg?.text || "";

            // Download de mídia (se necessário)
            if (DOWNLOADABLE_MEDIA_TYPES.includes(mediaType)) {
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  "buffer",
                  {},
                  {
                    logger: undefined as any,
                    reuploadRequest: wbot.updateMediaMessage
                  }
                );

                if (buffer) {
                  const fileName = `${msg.key.id}.${mediaType === "audio" ? "ogg" : "jpg"}`;
                  const folder = path.join(
                    __dirname,
                    "..",
                    "..",
                    "..",
                    "public",
                    `company${companyId}`,
                    `contact${contact.id}`
                  );

                  if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder, { recursive: true });
                  }

                  const filePath = path.join(folder, fileName);
                  await writeFileAsync(filePath, buffer as Buffer);
                  mediaUrl = fileName;

                  logger.info(`[SyncChatHistory] Mídia baixada: ${fileName}`);
                }
              } catch (err: any) {
                logger.error(`[SyncChatHistory] Erro ao baixar mídia: ${err.message}`);
              }
            }
          } else if (messageType === "reactionMessage") {
            // Reação - processar separadamente
            const reactionMsg = messageContent.reactionMessage;
            body = reactionMsg?.text || "";
            mediaType = "reactionMessage";
          } else {
            body = JSON.stringify(messageContent);
          }

          // Criar mensagem no banco
          const messageData = {
            wid: msg.key.id,
            ticketId: ticket.id,
            contactId: msg.key.fromMe ? null : contact.id,
            body,
            fromMe: Boolean(msg.key.fromMe),
            mediaType,
            mediaUrl,
            read: true,
            quotedMsgId: messageContent.extendedTextMessage?.contextInfo?.stanzaId || null,
            ack: msg.key.fromMe ? 3 : 0,
            remoteJid: msg.key.remoteJid,
            participant: msg.key.participant || msg.participant || null,
            dataJson: JSON.stringify(msg),
            companyId,
            createdAt: new Date(msg.messageTimestamp * 1000),
            updatedAt: new Date(msg.messageTimestamp * 1000)
          };

          const createdMessage = await Message.create(messageData);

          // Notificar frontend via Socket.IO
          io.of(`/company-${companyId}-mainchannel`)
            .to(`company-${companyId}-mainchannel`)
            .to(ticket.id.toString())
            .to(ticket.status)
            .to("notification")
            .emit(`company-${companyId}-appMessage`, {
              action: "create",
              message: createdMessage,
              ticket,
              contact
            });

          syncedCount++;
        } catch (err: any) {
          logger.error(`[SyncChatHistory] Erro ao processar mensagem ${msg?.key?.id}: ${err.message}`);
        }
      }

      logger.info(`[SyncChatHistory] Sync completo: ${syncedCount} mensagens sincronizadas`);

      return {
        synced: syncedCount,
        skipped: false
      };

    } finally {
      unregisterHistoryHandler(jid, messageHandler);
      cancelFetchRequest(fetchId);
    }

  } catch (err: any) {
    logger.error(`[SyncChatHistory] Erro ao sincronizar histórico: ${err.message}`);
    throw err;
  } finally {
    releaseLock();
  }
};

export default SyncChatHistoryService;
