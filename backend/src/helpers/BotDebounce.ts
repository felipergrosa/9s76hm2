/**
 * Controle de debounce para processamento do bot
 * Evita que mensagens sejam processadas múltiplas vezes
 */

interface ProcessingEntry {
  ticketId: number;
  messageId: string;
  timestamp: number;
}

// Cache de mensagens em processamento
const processingMessages: Map<string, ProcessingEntry> = new Map();

// Tempo mínimo entre processamentos do mesmo ticket (em ms)
const DEBOUNCE_TIME = 3000; // 3 segundos

// Limpar entradas antigas a cada 30 segundos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of processingMessages.entries()) {
    if (now - entry.timestamp > 60000) { // Remove após 1 minuto
      processingMessages.delete(key);
    }
  }
}, 30000);

/**
 * Verifica se uma mensagem pode ser processada pelo bot
 * @param ticketId ID do ticket
 * @param messageId ID da mensagem (wid)
 * @returns true se pode processar, false se deve ignorar (duplicada)
 */
export function canProcessBotMessage(ticketId: number, messageId: string): boolean {
  const key = `${ticketId}`;
  const now = Date.now();
  
  const existing = processingMessages.get(key);
  
  // Se já existe uma entrada recente para este ticket, verificar
  if (existing) {
    // Se é a mesma mensagem, é duplicada
    if (existing.messageId === messageId) {
      console.log(`[BotDebounce] Mensagem duplicada ignorada: ticket=${ticketId}, messageId=${messageId}`);
      return false;
    }
    
    // Se é outra mensagem mas dentro do tempo de debounce, aguardar
    if (now - existing.timestamp < DEBOUNCE_TIME) {
      console.log(`[BotDebounce] Debounce ativo para ticket=${ticketId}, aguardando ${DEBOUNCE_TIME - (now - existing.timestamp)}ms`);
      return false;
    }
  }
  
  // Registrar esta mensagem como em processamento
  processingMessages.set(key, {
    ticketId,
    messageId,
    timestamp: now
  });
  
  return true;
}

/**
 * Marca que o processamento de uma mensagem foi concluído
 * @param ticketId ID do ticket
 */
export function markBotProcessingComplete(ticketId: number): void {
  // Não remove imediatamente, mantém por um tempo para evitar duplicatas
  // A limpeza é feita pelo setInterval
}

/**
 * Limpa o cache de processamento para um ticket específico
 * Útil quando o ticket muda de status (ex: sai do bot)
 * @param ticketId ID do ticket
 */
export function clearBotProcessingCache(ticketId: number): void {
  processingMessages.delete(`${ticketId}`);
}
