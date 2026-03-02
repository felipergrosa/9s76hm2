import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

/**
 * Serviço para gerenciar a janela de sessão de 24h da API Oficial WhatsApp Business
 * 
 * Regras da API Oficial:
 * - Quando o cliente envia uma mensagem, abre-se uma janela de 24h para responder gratuitamente
 * - Após 24h, só é possível enviar mensagens usando templates aprovados (pago)
 * - A janela é renovada a cada mensagem recebida do cliente
 */
const HOURS_WINDOW = 24;

interface SessionWindowStatus {
  hasOpenSession: boolean;
  sessionWindowExpiresAt: Date | null;
  remainingMs: number | null;
  remainingHours: number | null;
  remainingMinutes: number | null;
  remainingSeconds: number | null;
  isOfficial: boolean;
  formatted: string; // "23:45:12" ou "EXPIRADO" ou "N/A"
}

/**
 * Atualiza a janela de sessão quando uma mensagem é recebida do cliente
 * Deve ser chamado APENAS para mensagens recebidas (fromMe=false) em conexões API Oficial
 */
export const UpdateSessionWindow = async (
  ticketId: number,
  whatsappId: number
): Promise<void> => {
  try {
    // Verificar se a conexão é API Oficial
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (!whatsapp || whatsapp.channelType !== "official") {
      logger.debug(
        `[SessionWindow] Ticket ${ticketId}: conexão não é API Oficial, ignorando atualização de janela`
      );
      return;
    }

    // Calcular nova expiração (agora + 24h)
    const expiresAt = new Date(Date.now() + HOURS_WINDOW * 60 * 60 * 1000);

    // Atualizar ticket
    await Ticket.update(
      { sessionWindowExpiresAt: expiresAt },
      { where: { id: ticketId } }
    );

    logger.info(
      `[SessionWindow] Ticket ${ticketId}: janela renovada até ${expiresAt.toISOString()}`
    );
  } catch (error: any) {
    logger.error(`[SessionWindow] Erro ao atualizar janela do ticket ${ticketId}: ${error.message}`);
  }
};

/**
 * Obtém o status atual da janela de sessão de um ticket
 */
export const GetSessionWindowStatus = async (
  ticketId: number
): Promise<SessionWindowStatus> => {
  try {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [{ model: Whatsapp, as: "whatsapp" }]
    });

    if (!ticket) {
      return {
        hasOpenSession: false,
        sessionWindowExpiresAt: null,
        remainingMs: null,
        remainingHours: null,
        remainingMinutes: null,
        remainingSeconds: null,
        isOfficial: false,
        formatted: "N/A"
      };
    }

    const whatsapp = ticket.whatsapp;
    const isOfficial = whatsapp?.channelType === "official";

    // Se não é API oficial, não há janela de 24h
    if (!isOfficial) {
      return {
        hasOpenSession: true, // Sempre aberto para Baileys
        sessionWindowExpiresAt: null,
        remainingMs: null,
        remainingHours: null,
        remainingMinutes: null,
        remainingSeconds: null,
        isOfficial: false,
        formatted: "N/A"
      };
    }

    const expiresAt = ticket.sessionWindowExpiresAt;

    if (!expiresAt) {
      return {
        hasOpenSession: false,
        sessionWindowExpiresAt: null,
        remainingMs: null,
        remainingHours: null,
        remainingMinutes: null,
        remainingSeconds: null,
        isOfficial: true,
        formatted: "Sem janela"
      };
    }

    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const remainingMs = Math.max(0, expires - now);
    const hasOpenSession = remainingMs > 0;

    const remainingSeconds = Math.floor(remainingMs / 1000);
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingHours = Math.floor(remainingMinutes / 60);

    const hours = remainingHours;
    const minutes = remainingMinutes % 60;
    const seconds = remainingSeconds % 60;

    const formatted = hasOpenSession
      ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : "EXPIRADO";

    return {
      hasOpenSession,
      sessionWindowExpiresAt: expiresAt,
      remainingMs,
      remainingHours,
      remainingMinutes,
      remainingSeconds,
      isOfficial: true,
      formatted
    };
  } catch (error: any) {
    logger.error(`[SessionWindow] Erro ao obter status do ticket ${ticketId}: ${error.message}`);
    return {
      hasOpenSession: false,
      sessionWindowExpiresAt: null,
      remainingMs: null,
      remainingHours: null,
      remainingMinutes: null,
      remainingSeconds: null,
      isOfficial: false,
      formatted: "ERRO"
    };
  }
};

export default {
  UpdateSessionWindow,
  GetSessionWindowStatus
};
