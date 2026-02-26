import logger from "../utils/logger";
import { proto } from "@whiskeysockets/baileys";

// Mapa de handlers registrados por JID
const historyHandlers = new Map<string, Set<Function>>();

// Mapa para rastrear requisições ativas de fetchMessageHistory
const activeFetches = new Map<string, {
  resolve: Function;
  reject: Function;
  timeoutId: NodeJS.Timeout;
  messages: any[];
  startTime: number;
}>();

/**
 * Registra um handler para receber mensagens de um JID específico
 */
export const registerHistoryHandler = (jid: string, handler: Function): void => {
  if (!historyHandlers.has(jid)) {
    historyHandlers.set(jid, new Set());
  }
  historyHandlers.get(jid)!.add(handler);
  logger.debug(`[HistoryHandler] Handler registrado para JID: ${jid}`);
};

/**
 * Remove um handler de um JID
 */
export const unregisterHistoryHandler = (jid: string, handler: Function): void => {
  const handlers = historyHandlers.get(jid);
  if (handlers) {
    handlers.delete(handler);
    if (handlers.size === 0) {
      historyHandlers.delete(jid);
    }
  }
};

/**
 * Registra uma requisição de fetchMessageHistory ativa
 * Retorna um ID único para a requisição
 */
export const registerFetchRequest = (jid: string): string => {
  const fetchId = `${jid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.debug(`[HistoryHandler] Requisição fetch registrada: ${fetchId}`);
  return fetchId;
};

/**
 * Inicia uma requisição de fetch com Promise e timeout
 */
export const startFetchRequest = (
  fetchId: string,
  jid: string,
  timeoutMs: number = 60000
): Promise<{ messages: any[]; isLatest: boolean; progress: number; syncType?: string }> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      logger.warn(`[HistoryHandler] Timeout na requisição ${fetchId} (${timeoutMs}ms)`);
      activeFetches.delete(fetchId);
      reject(new Error("Timeout ao buscar histórico"));
    }, timeoutMs);

    activeFetches.set(fetchId, {
      resolve,
      reject,
      timeoutId,
      messages: [],
      startTime: Date.now()
    });

    logger.debug(`[HistoryHandler] Requisição ${fetchId} iniciada com timeout ${timeoutMs}ms`);
  });
};

/**
 * Cancela uma requisição de fetch
 */
export const cancelFetchRequest = (fetchId: string): void => {
  const fetch = activeFetches.get(fetchId);
  if (fetch) {
    clearTimeout(fetch.timeoutId);
    activeFetches.delete(fetchId);
    logger.debug(`[HistoryHandler] Requisição ${fetchId} cancelada`);
  }
};

/**
 * Handler principal para o evento messaging-history.set
 * Este deve ser registrado no wbot.ev.on("messaging-history.set", handleMessagingHistorySet)
 */
export const handleMessagingHistorySet = async (event: any): Promise<void> => {
  try {
    const { messages = [], isLatest, progress, syncType } = event || {};

    logger.debug(`[HistoryHandler] messaging-history.set recebido: ${messages.length} mensagens, isLatest=${isLatest}, progress=${progress}, syncType=${syncType}`);

    if (messages.length === 0) {
      return;
    }

    // Agrupar mensagens por JID
    const byJid = new Map<string, any[]>();
    messages.forEach((msg: any) => {
      const jid = msg?.key?.remoteJid;
      if (jid) {
        if (!byJid.has(jid)) {
          byJid.set(jid, []);
        }
        byJid.get(jid)!.push(msg);
      }
    });

    // Notificar handlers registrados por JID
    for (const [jid, msgs] of byJid) {
      const handlers = historyHandlers.get(jid);
      if (handlers && handlers.size > 0) {
        logger.debug(`[HistoryHandler] Notificando ${handlers.size} handlers para JID ${jid} (${msgs.length} mensagens)`);
        
        for (const handler of handlers) {
          try {
            await handler(msgs, { isLatest, progress, syncType });
          } catch (err: any) {
            logger.error(`[HistoryHandler] Erro no handler para JID ${jid}: ${err?.message}`);
          }
        }
      }
    }

    // Verificar requisições fetchMessageHistory ativas
    for (const [fetchId, fetch] of activeFetches) {
      const [fetchJid] = fetchId.split('_');
      
      // Verificar se há mensagens para este JID
      const relevantMessages = messages.filter((m: any) => m?.key?.remoteJid === fetchJid);
      
      if (relevantMessages.length > 0) {
        logger.debug(`[HistoryHandler] Requisição ${fetchId} recebeu ${relevantMessages.length} mensagens`);
        
        fetch.messages.push(...relevantMessages);
        
        // Se isLatest === true ou não mais mensagens, resolver
        if (isLatest === true || (isLatest === undefined && relevantMessages.length < 50)) {
          clearTimeout(fetch.timeoutId);
          activeFetches.delete(fetchId);
          
          const elapsed = Date.now() - fetch.startTime;
          logger.info(`[HistoryHandler] Requisição ${fetchId} concluída em ${elapsed}ms (${fetch.messages.length} mensagens)`);
          
          fetch.resolve({
            messages: fetch.messages,
            isLatest: isLatest !== undefined ? isLatest : true,
            progress: progress || 100,
            syncType
          });
        }
      }
    }

  } catch (err: any) {
    logger.error(`[HistoryHandler] Erro ao processar messaging-history.set: ${err?.message}`);
  }
};

/**
 * Obtém estatísticas dos handlers
 */
export const getHandlerStats = () => {
  return {
    registeredJids: Array.from(historyHandlers.keys()),
    activeFetches: Array.from(activeFetches.keys()),
    handlerCount: Array.from(historyHandlers.values()).reduce((sum, set) => sum + set.size, 0)
  };
};
