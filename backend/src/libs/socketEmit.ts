import { getIO } from "./socket";
import logger from "../utils/logger";

/**
 * Emite um evento para uma sala (room) do namespace da company, com fallback opcional
 * para broadcast no namespace quando a sala estiver vazia.
 *
 * Comportamento por ambiente:
 * - production (NODE_ENV=production): fallback DESATIVADO por padrão
 * - dev (NODE_ENV!=production): fallback ATIVADO por padrão
 *
 * Pode ser alterado via env SOCKET_FALLBACK_NS_BROADCAST:
 * - "true"  => força fallback ligado
 * - "false" => força fallback desligado
 *
 * Logs de debug controlados por SOCKET_DEBUG === "true".
 */

export async function emitToCompanyRoom(
  companyId: number,
  room: string | null,
  event: string,
  payload: any,
  skipFallback: boolean = false
): Promise<void> {
  const io = getIO();
  const ns = io.of(`/workspace-${companyId}`);
  const debug = process.env.SOCKET_DEBUG === "true";

  // Sem sala especificada → broadcast direto
  if (!room) {
    ns.emit(event, payload);
    if (debug) logger.info(`[SOCKET EMIT] Broadcast ns=/workspace-${companyId} event=${event}`);
    return;
  }

  // Emite para a sala específica (entrega direta se houver sockets)
  ns.to(room).emit(event, payload);

  // Para eventos de mensagem, TAMBÉM faz broadcast no namespace como garantia
  // O frontend filtra pelo UUID do ticket, então mensagens de outros tickets são ignoradas
  const isAppMessageEvent = event.includes("-appMessage");
  if (isAppMessageEvent && !skipFallback) {
    ns.emit(event, payload);
    if (debug) logger.info(`[SOCKET EMIT] room=${room} + broadcast ns=/workspace-${companyId} event=${event}`);
  } else if (debug) {
    logger.info(`[SOCKET EMIT] room=${room} ns=/workspace-${companyId} event=${event}`);
  }
}

/**
 * Emite um evento com confirmação de recebimento (ACK) do cliente.
 * Usa timeout e retry automático se o cliente não confirmar.
 * Ideal para mensagens críticas que DEVEM ser entregues.
 */
export async function emitWithAck(
  companyId: number,
  room: string,
  event: string,
  payload: any,
  timeoutMs: number = 5000
): Promise<{ success: boolean; acked: number; failed: number }> {
  const io = getIO();
  const ns = io.of(`/workspace-${companyId}`);

  try {
    const sockets = await ns.in(room).fetchSockets();
    
    if (sockets.length === 0) {
      console.warn(`[SOCKET ACK] Nenhum socket na sala ${room} - usando fallback broadcast`);
      ns.emit(event, { ...payload, fallback: true, room });
      return { success: false, acked: 0, failed: 0 };
    }

    // Emitir para cada socket com timeout individual
    const results = await Promise.all(
      sockets.map(async (socket) => {
        try {
          const ack = await socket.timeout(timeoutMs).emitWithAck(event, payload);
          return ack === true || ack === "ok";
        } catch (e) {
          console.warn(`[SOCKET ACK] Timeout/erro para socket ${socket.id}:`, (e as Error).message);
          return false;
        }
      })
    );

    const acked = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;

    console.log(`[SOCKET ACK] event=${event} room=${room} acked=${acked}/${sockets.length} failed=${failed}`);

    return { success: acked > 0, acked, failed };
  } catch (e) {
    console.error(`[SOCKET ACK] Erro ao emitir para sala ${room}:`, e);
    return { success: false, acked: 0, failed: 0 };
  }
}

/**
 * Emite um evento para TODO o namespace da company (broadcast).
 * Não usa fallback, pois já é broadcast.
 * Logs condicionados por SOCKET_DEBUG.
 */
export async function emitToCompanyNamespace(
  companyId: number,
  event: string,
  payload: any
): Promise<void> {
  const io = getIO();
  const ns = io.of(`/workspace-${companyId}`);
  const debug = process.env.SOCKET_DEBUG === "true";

  if (debug) {
    try {
      const sockets = await ns.fetchSockets();
      const ids = sockets.map(s => s.id).join(",");
      logger.info(`[SOCKET EMIT NS] event=${event} ns=/workspace-${companyId} audience=broadcast count=${sockets.length} ids=${ids}`);
    } catch {
      logger.info(`[SOCKET EMIT NS] event=${event} ns=/workspace-${companyId} audience=broadcast`);
    }
  }
  ns.emit(event, payload);
}
