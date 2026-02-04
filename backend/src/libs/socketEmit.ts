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
  room: string,
  event: string,
  payload: any,
  skipFallback: boolean = false // Se true, nunca faz broadcast fallback
): Promise<void> {
  const io = getIO();
  const ns = io.of(`/workspace-${companyId}`);

  const explicit = process.env.SOCKET_FALLBACK_NS_BROADCAST;
  const isProd = process.env.NODE_ENV === "production";
  const isAppMessageEvent = event.includes("-appMessage");
  // Desabilita fallback se skipFallback=true ou se estamos em produção
  // EXCEÇÃO: para eventos appMessage, manter fallback para evitar perda de realtime quando o cliente não está na sala
  const fallbackEnabled = isAppMessageEvent || (!skipFallback && (explicit === "true" || (explicit !== "false" && !isProd)));
  const debug = process.env.SOCKET_DEBUG === "true";

  try {
    const sockets = await ns.in(room).fetchSockets();
    const ids = sockets.map(s => s.id).join(",");
    
    // Log sempre para debug de mensagens
    console.log(
      `[SOCKET EMIT] event=${event} ns=/workspace-${companyId} room=${room} count=${sockets.length} ids=${ids || "nenhum"} fallbackEnabled=${fallbackEnabled}`
    );

    if (sockets.length === 0) {
      console.warn(`[SOCKET EMIT] SALA VAZIA: ns=/workspace-${companyId} room=${room} - Nenhum socket na sala!`);
      
      if (fallbackEnabled) {
        console.log(`[SOCKET EMIT] Executando fallback broadcast para event=${event} ns=/workspace-${companyId}`);
        ns.emit(event, { ...payload, fallback: true, room });
      } else {
        console.warn(`[SOCKET EMIT] Fallback DESABILITADO - mensagem pode não chegar ao destinatário!`);
      }
    } else {
      const result = ns.to(room).emit(event, payload);
      console.log(`[SOCKET EMIT] Emitido para ${sockets.length} sockets na sala ${room}, resultado=${result}`);
    }
  } catch (e) {
    console.error(`[SOCKET EMIT] ERRO ao consultar sala ns=/workspace-${companyId} room=${room}:`, e);
    // Em caso de erro ao consultar sockets, ainda tentamos emitir para a sala
    try {
      ns.to(room).emit(event, payload);
      console.log(`[SOCKET EMIT] Tentativa de emissão após erro para sala ${room}`);
    } catch (emitErr) {
      console.error(`[SOCKET EMIT] Falha total na emissão:`, emitErr);
    }
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
