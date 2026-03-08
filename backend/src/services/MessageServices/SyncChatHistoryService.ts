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
 * Sincroniza o histórico de mensagens de um chat do WhatsApp
 * DESABILITADO para evitar corrupção do socket (xml-not-well-formed)
 */
const SyncChatHistoryService = async ({
  ticketId,
  companyId,
  messageCount = 100,
  forceSync = false,
  syncAll = false,
  maxPages = 5
}: SyncChatHistoryParams): Promise<SyncResult> => {
  // CRÍTICO: Desabilitar fetchMessageHistory para evitar corrupção do socket
  // O xml-not-well-formed é causado por múltiplas chamadas concorrentes
  logger.warn(`[SyncChatHistory] DESABILITADO - Prevenindo corrupção do socket (ticketId=${ticketId})`);
  
  return {
    synced: 0,
    skipped: true,
    reason: "Sync desabilitado para prevenção de corrupção do socket"
  };
};

export default SyncChatHistoryService;
