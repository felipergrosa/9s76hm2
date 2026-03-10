import { WASocket, jidNormalizedUser } from "@whiskeysockets/baileys";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import logger from "../utils/logger";

// Tipo estendido que inclui store (usado internamente pelo wbot.ts)
type WbotSession = WASocket & {
  store?: {
    chats?: { [jid: string]: any };
    messages?: { [jid: string]: any };
    contacts?: { [jid: string]: any };
  };
};

interface DiscoverChatJidParams {
  wbot: WbotSession;
  ticket: Ticket;
  contact: Contact;
}

interface DiscoverResult {
  jid: string;
  source: "store_chats" | "remote_jid" | "fallback";
  confidence: "high" | "medium" | "low";
}

/**
 * Descobre o JID correto do chat usando o store do Baileys
 * em vez de inferir manualmente por heurística
 * 
 * Ordem de prioridade:
 * 1. store.chats (mais confiável - fonte real do Baileys)
 * 2. contact.remoteJid (se válido e não @lid)
 * 3. JID padrão construído (fallback)
 */
export const discoverChatJid = async ({ 
  wbot, 
  ticket, 
  contact 
}: DiscoverChatJidParams): Promise<DiscoverResult> => {
  
  // 1. GRUPOS: usar remoteJid direto (grupos não mudam JID)
  if (ticket.isGroup && contact.remoteJid?.includes("@g.us")) {
    logger.info(`[DiscoverChat] Grupo detectado: ${contact.remoteJid}`);
    return {
      jid: contact.remoteJid,
      source: "remote_jid",
      confidence: "high"
    };
  }

  // 2. STORE.CHATS: consultar lista de chats conhecidos (fonte mais confiável)
  if (wbot?.store?.chats) {
    try {
      const chats = Object.values(wbot.store.chats) as any[];
      
      // Número do contato limpo (apenas dígitos)
      const contactNumber = String(contact.number || "").replace(/\D/g, "");
      
      if (contactNumber.length >= 10) {
        // Buscar chat que contenha o número do contato
        const matchingChat = chats.find((chat: any) => {
          const chatJid = String(chat.id || "");
          
          // Match por número exato
          if (chatJid.includes(contactNumber)) {
            return true;
          }
          
          // Match por remoteJid do contato
          if (contact.remoteJid && chatJid === contact.remoteJid) {
            return true;
          }
          
          return false;
        });
        
        if (matchingChat?.id) {
          logger.info(`[DiscoverChat] JID encontrado via store.chats: ${matchingChat.id} (${chats.length} chats no store)`);
          return {
            jid: matchingChat.id,
            source: "store_chats",
            confidence: "high"
          };
        }
        
        logger.debug(`[DiscoverChat] Nenhum chat encontrado no store para número ${contactNumber} (${chats.length} chats disponíveis)`);
      }
    } catch (error) {
      logger.warn(`[DiscoverChat] Erro ao consultar store.chats: ${(error as Error)?.message}`);
    }
  } else {
    logger.debug(`[DiscoverChat] store.chats não disponível no wbot`);
  }

  // 3. REMOTE_JID: usar se válido (não @lid)
  if (contact.remoteJid && !contact.remoteJid.includes("@lid")) {
    logger.info(`[DiscoverChat] Usando remoteJid do contato: ${contact.remoteJid}`);
    return {
      jid: contact.remoteJid,
      source: "remote_jid",
      confidence: "medium"
    };
  }

  // 4. FALLBACK: construir JID padrão (última opção)
  const contactNumber = String(contact.number || "").replace(/\D/g, "");
  
  if (contactNumber.length < 10) {
    logger.error(`[DiscoverChat] Número inválido para ticket ${ticket.id}: ${contactNumber}`);
    throw new Error(`Número de contato inválido: ${contactNumber}`);
  }
  
  const standardJid = `${contactNumber}@s.whatsapp.net`;
  
  logger.warn(`[DiscoverChat] Usando JID padrão (fallback): ${standardJid} para ticket ${ticket.id}`);
  return {
    jid: standardJid,
    source: "fallback",
    confidence: "low"
  };
};

/**
 * Valida se um JID está no formato correto
 */
export const isValidJid = (jid: string): boolean => {
  if (!jid || typeof jid !== "string") return false;
  
  // Grupos: formato 123456789@g.us
  if (jid.includes("@g.us")) {
    return /^\d+@g\.us$/.test(jid);
  }
  
  // Chats individuais: formato 5511999999999@s.whatsapp.net
  if (jid.includes("@s.whatsapp.net")) {
    return /^\d{10,15}@s\.whatsapp\.net$/.test(jid);
  }
  
  // LID: formato 123456789@lid
  if (jid.includes("@lid")) {
    return /^\d+@lid$/.test(jid);
  }
  
  return false;
};

/**
 * Normaliza um JID para formato padrão
 */
export const normalizeJid = (jid: string): string => {
  try {
    return jidNormalizedUser(jid);
  } catch (error) {
    logger.warn(`[DiscoverChat] Falha ao normalizar JID ${jid}: ${(error as Error)?.message}`);
    return jid;
  }
};
