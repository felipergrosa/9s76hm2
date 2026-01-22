import { Server as SocketIO } from "socket.io";
import logger from "../utils/logger";

/**
 * Throttle de emissões Socket.IO para evitar sobrecarga
 * Impede emissões duplicadas para a mesma sala/evento em intervalo curto
 */

interface ThrottleEntry {
    lastEmit: number;
    data: string; // Hash dos dados para detectar duplicatas
}

// Cache de throttle por room:event:id
const throttleCache = new Map<string, ThrottleEntry>();

// Intervalo mínimo entre emissões iguais (ms)
const THROTTLE_INTERVAL = parseInt(process.env.SOCKET_THROTTLE_MS || "300", 10);

// Limpa cache antigo a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    const expireThreshold = 60000; // 1 minuto

    for (const [key, entry] of throttleCache.entries()) {
        if (now - entry.lastEmit > expireThreshold) {
            throttleCache.delete(key);
        }
    }
}, 300000);

/**
 * Gera hash simples dos dados para comparação
 */
const hashData = (data: any): string => {
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
};

/**
 * Extrai ID do payload para criar chave única
 */
const extractId = (data: any): string => {
    if (!data) return "none";
    if (data.id) return String(data.id);
    if (data.ticket?.id) return String(data.ticket.id);
    if (data.ticketId) return String(data.ticketId);
    if (data.contact?.id) return String(data.contact.id);
    return "all";
};

/**
 * Emite evento com throttle inteligente
 * Evita emissões duplicadas em intervalo curto
 * 
 * @param io - Instância do Socket.IO
 * @param room - Nome da sala (ex: "company-1-ticket")
 * @param event - Nome do evento (ex: "ticket")
 * @param data - Dados a emitir
 * @param options - Opções adicionais
 */
export const throttledEmit = (
    io: SocketIO,
    room: string,
    event: string,
    data: any,
    options?: {
        force?: boolean; // Ignorar throttle
        minPayload?: boolean; // Enviar apenas campos essenciais
    }
): boolean => {
    const id = extractId(data);
    const key = `${room}:${event}:${id}`;
    const now = Date.now();
    const dataHash = hashData(data);

    // Verificar throttle
    const cached = throttleCache.get(key);
    if (cached && !options?.force) {
        const elapsed = now - cached.lastEmit;

        // Se dados são idênticos e dentro do intervalo, ignora
        if (elapsed < THROTTLE_INTERVAL && cached.data === dataHash) {
            if (process.env.SOCKET_DEBUG === "true") {
                logger.debug(`[SOCKET THROTTLE] Ignorando emissão duplicada: ${key}`);
            }
            return false;
        }
    }

    // Atualizar cache
    throttleCache.set(key, { lastEmit: now, data: dataHash });

    // Preparar payload (opcionalmente reduzido)
    let payload = data;
    if (options?.minPayload && data?.ticket) {
        payload = {
            ...data,
            ticket: {
                id: data.ticket.id,
                status: data.ticket.status,
                userId: data.ticket.userId,
                queueId: data.ticket.queueId,
                updatedAt: data.ticket.updatedAt,
                unreadMessages: data.ticket.unreadMessages,
                lastMessage: data.ticket.lastMessage,
                contactId: data.ticket.contactId,
                // Manter contact mínimo se existir
                contact: data.ticket.contact ? {
                    id: data.ticket.contact.id,
                    name: data.ticket.contact.name,
                    number: data.ticket.contact.number,
                    profilePicUrl: data.ticket.contact.profilePicUrl
                } : undefined
            }
        };
    }

    // Emitir
    io.to(room).emit(event, payload);

    if (process.env.SOCKET_DEBUG === "true") {
        logger.debug(`[SOCKET EMIT] ${room} -> ${event} (id=${id})`);
    }

    return true;
};

/**
 * Emite para múltiplas salas com throttle
 */
export const throttledEmitToRooms = (
    io: SocketIO,
    rooms: string[],
    event: string,
    data: any,
    options?: { force?: boolean; minPayload?: boolean }
): void => {
    for (const room of rooms) {
        throttledEmit(io, room, event, data, options);
    }
};

/**
 * Estatísticas do throttle (para debug)
 */
export const getThrottleStats = () => ({
    cacheSize: throttleCache.size,
    interval: THROTTLE_INTERVAL
});

export default {
    throttledEmit,
    throttledEmitToRooms,
    getThrottleStats
};
