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
    const { messages = [], chats = [], contacts = [], isLatest, progress, syncType, peerDataRequestSessionId } = event || {};

    // ON_DEMAND sync: syncType=6 (ON_DEMAND) OU peerDataRequestSessionId presente
    // O Baileys pode retornar isLatest=false ou undefined para ON_DEMAND — nunca true
    const isOnDemand = syncType === 6 || !!peerDataRequestSessionId;
    logger.info(`[HistoryHandler] messaging-history.set recebido: msgs=${messages.length} chats=${chats.length} contacts=${contacts.length} isLatest=${isLatest} progress=${progress} syncType=${syncType} peerSessionId=${peerDataRequestSessionId || 'N/A'} isOnDemand=${isOnDemand}`);

    // Log diagnóstico: estrutura das primeiras 3 mensagens
    if (messages.length > 0) {
      for (let i = 0; i < Math.min(3, messages.length); i++) {
        const m = messages[i];
        const hasMessage = !!m?.message;
        const msgKeys = hasMessage ? Object.keys(m.message) : [];
        logger.info(`[HistoryHandler] msg[${i}]: key.id=${m?.key?.id} remoteJid=${m?.key?.remoteJid} fromMe=${m?.key?.fromMe} hasMessage=${hasMessage} msgTypes=[${msgKeys.join(',')}] ts=${m?.messageTimestamp}`);
      }
    }

    if (messages.length === 0) {
      // Resolver fetches pendentes se isLatest=true OU se é resposta ON_DEMAND vazia
      if (isLatest === true || isOnDemand) {
        for (const [fetchId, fetch] of activeFetches) {
          clearTimeout(fetch.timeoutId);
          activeFetches.delete(fetchId);
          const elapsed = Date.now() - fetch.startTime;
          logger.info(`[HistoryHandler] Requisição ${fetchId} concluída (vazia, isLatest=${isLatest} isOnDemand=${!!isOnDemand}) em ${elapsed}ms`);
          fetch.resolve({
            messages: fetch.messages,
            isLatest: true,
            progress: progress || 100,
            syncType
          });
        }
      }
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
      // Extrair JID do fetchId — formato: jid_timestamp_random
      // JIDs podem conter '@' mas nunca '_' seguido de número (timestamps)
      const parts = fetchId.split('_');
      // Reconstruir JID (tudo antes do timestamp numérico)
      let fetchJid = parts[0];
      for (let i = 1; i < parts.length; i++) {
        if (/^\d{10,}$/.test(parts[i])) break; // Encontrou o timestamp
        fetchJid += '_' + parts[i];
      }
      
      // Verificar se há mensagens para este JID
      const relevantMessages = messages.filter((m: any) => m?.key?.remoteJid === fetchJid);
      
      logger.info(`[HistoryHandler] Verificando fetch ${fetchId}: fetchJid=${fetchJid}, msgs encontradas=${relevantMessages.length}, total msgs no evento=${messages.length}`);
      
      // Se não encontrou por JID exato, tentar match parcial (LID vs s.whatsapp.net)
      let finalMessages = relevantMessages;
      if (finalMessages.length === 0 && messages.length > 0) {
        // Listar JIDs únicos das mensagens recebidas para debug
        const uniqueJids = [...new Set(messages.map((m: any) => m?.key?.remoteJid).filter(Boolean))];
        logger.info(`[HistoryHandler] JIDs nas mensagens recebidas: [${uniqueJids.join(', ')}]`);
        
        // Se temos apenas um fetch ativo e as mensagens são de um JID diferente,
        // pode ser que o WhatsApp respondeu com um JID diferente (LID vs número)
        if (activeFetches.size === 1 && uniqueJids.length > 0) {
          logger.info(`[HistoryHandler] Apenas 1 fetch ativo, atribuindo ${messages.length} mensagens ao fetch ${fetchId}`);
          finalMessages = messages;
        }
      }
      
      if (finalMessages.length > 0) {
        // Filtrar apenas mensagens com conteúdo real (não placeholders)
        const validMessages = finalMessages.filter((m: any) => {
          if (!m?.message) {
            logger.debug(`[HistoryHandler] Mensagem sem conteúdo: key.id=${m?.key?.id} remoteJid=${m?.key?.remoteJid}`);
            return false;
          }
          return true;
        });
        
        logger.info(`[HistoryHandler] Requisição ${fetchId}: ${finalMessages.length} msgs totais, ${validMessages.length} com conteúdo`);
        
        fetch.messages.push(...validMessages);
        
        // Resolver: se isLatest=true, ou se é resposta ON_DEMAND (isLatest=undefined + peerDataRequestSessionId)
        // IMPORTANTE: Para ON_DEMAND syncs, o Baileys seta isLatest=undefined (nunca true)
        const shouldResolve = isLatest === true || isOnDemand;
          
        if (shouldResolve) {
          clearTimeout(fetch.timeoutId);
          activeFetches.delete(fetchId);
          
          const elapsed = Date.now() - fetch.startTime;
          logger.info(`[HistoryHandler] Requisição ${fetchId} concluída em ${elapsed}ms (${fetch.messages.length} mensagens com conteúdo)`);
          
          fetch.resolve({
            messages: fetch.messages,
            isLatest: isLatest !== undefined ? isLatest : true,
            progress: progress || 100,
            syncType
          });
        } else {
          logger.info(`[HistoryHandler] Requisição ${fetchId}: aguardando mais mensagens (isLatest=${isLatest})`);
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
