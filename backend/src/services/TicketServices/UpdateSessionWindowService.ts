import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { Op } from "sequelize";

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
  whatsappId: number,
  receivedAtMs: number = Date.now()
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

    if (!Number.isFinite(receivedAtMs) || receivedAtMs <= 0) {
      throw new Error("Timestamp de mensagem recebida inválido");
    }

    // A janela começa no horário da mensagem, não no horário em que um webhook
    // atrasado foi processado. Nunca encurtar uma janela já mais recente.
    const expiresAt = new Date(Math.min(receivedAtMs, Date.now()) + HOURS_WINDOW * 60 * 60 * 1000);

    // A janela da Meta é do par contato×conexão: propaga para TODOS os
    // tickets não-fechados do contato nesta conexão. Sem isso, um segundo
    // ticket (novo ciclo, campanha, transferência) fica com campo nulo e o
    // envio/badge são bloqueados apesar da janela estar aberta.
    const sourceTicket = await Ticket.findByPk(ticketId, {
      attributes: ["id", "contactId", "whatsappId", "companyId"]
    });

    const scope: any = {
      whatsappId,
      status: { [Op.ne]: "closed" },
      [Op.or]: [
        { sessionWindowExpiresAt: null },
        { sessionWindowExpiresAt: { [Op.lt]: expiresAt } }
      ]
    };

    if (sourceTicket?.contactId && sourceTicket?.companyId) {
      scope.contactId = sourceTicket.contactId;
      scope.companyId = sourceTicket.companyId;
    } else {
      // Fallback seguro: atualiza apenas o ticket de origem
      scope.id = ticketId;
    }

    await Ticket.update(
      { sessionWindowExpiresAt: expiresAt },
      { where: scope }
    );

    logger.info(
      `[SessionWindow] Ticket ${ticketId}: janela renovada até ${expiresAt.toISOString()}`
    );
  } catch (error: any) {
    logger.error(`[SessionWindow] Erro ao atualizar janela do ticket ${ticketId}: ${error.message}`);
    throw error;
  }
};

/**
 * Obtém o status atual da janela de sessão de um ticket
 */
export const GetSessionWindowStatus = async (
  ticketId: number,
  companyId?: number
): Promise<SessionWindowStatus> => {
  try {
    // Quando companyId é informado, restringe a busca ao tenant (anti cross-tenant)
    const ticket = await Ticket.findOne({
      where: companyId ? { id: ticketId, companyId } : { id: ticketId },
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

    // A janela da Meta é do par contato×conexão: usa o MAIOR
    // sessionWindowExpiresAt entre os tickets do contato nesta conexão,
    // não apenas o deste ticket (senão badge/input mostram "expirada" em
    // tickets que não receberam a última mensagem do cliente).
    const windowHolder = await Ticket.findOne({
      where: {
        companyId: ticket.companyId,
        contactId: ticket.contactId,
        whatsappId: ticket.whatsappId,
        sessionWindowExpiresAt: { [Op.ne]: null }
      },
      attributes: ["sessionWindowExpiresAt"],
      order: [["sessionWindowExpiresAt", "DESC"]]
    });

    const expiresAt = windowHolder?.sessionWindowExpiresAt || ticket.sessionWindowExpiresAt;

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
