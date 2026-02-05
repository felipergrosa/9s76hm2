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

// Delay entre tentativas de retry (ms)
const RETRY_DELAYS = [100, 300, 500]; // 100ms, 300ms, 500ms

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

  // Função para tentar emitir
  const tryEmit = async (attempt: number): Promise<boolean> => {
    try {
      const sockets = await ns.in(room).fetchSockets();
      const ids = sockets.map(s => s.id).join(",");
      
      if (sockets.length === 0) {
        if (attempt === 0) {
          console.warn(`[SOCKET EMIT] SALA VAZIA: ns=/workspace-${companyId} room=${room} - Nenhum socket na sala! Tentando retry...`);
        }
        return false;
      }
      
      const result = ns.to(room).emit(event, payload);
      console.log(`[SOCKET EMIT] Emitido para ${sockets.length} sockets na sala ${room} (tentativa ${attempt + 1}), resultado=${result}`);
      return true;
    } catch (e) {
      console.error(`[SOCKET EMIT] ERRO ao consultar sala (tentativa ${attempt + 1}):`, e);
      return false;
    }
  };

  // Tentativa inicial
  if (await tryEmit(0)) {
    return;
  }

  // Retry com delays progressivos
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
    
    if (await tryEmit(i + 1)) {
      return;
    }
  }

  // Todas as tentativas falharam - usar fallback
  console.warn(`[SOCKET EMIT] Todas as tentativas falharam para sala ${room} após ${RETRY_DELAYS.length + 1} tentativas`);
  
  if (fallbackEnabled) {
    console.log(`[SOCKET EMIT] Executando fallback broadcast para event=${event} ns=/workspace-${companyId}`);
    ns.emit(event, { ...payload, fallback: true, room });
  } else {
    console.warn(`[SOCKET EMIT] Fallback DESABILITADO - mensagem pode não chegar ao destinatário!`);
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
