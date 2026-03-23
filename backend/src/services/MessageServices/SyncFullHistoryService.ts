import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import { getWbotOrRecover } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { queueImportHistory } from "./ImportHistoryQueue";
import moment from "moment";

interface SyncFullHistoryParams {
  whatsappId: number;
  companyId: number;
  periodMonths?: number; // 0 = completo, 1, 3, 6 meses
  downloadMedia?: boolean;
}

interface SyncProgress {
  whatsappId: number;
  status: "preparing" | "syncing" | "completed" | "error";
  totalTickets: number;
  processedTickets: number;
  currentTicketId: number | null;
  currentTicketName: string | null;
  startedAt: Date;
  estimatedTimeRemaining?: number;
  error?: string;
}

// Map para rastrear progresso de sync por whatsappId
const syncProgressMap = new Map<number, SyncProgress>();

/**
 * Retorna o progresso atual de um sync
 */
export const getSyncProgress = (whatsappId: number): SyncProgress | null => {
  return syncProgressMap.get(whatsappId) || null;
};

/**
 * Serviço para sincronizar histórico completo de forma organizada
 * Processa ticket a ticket, com delays para evitar sobrecarga
 * 
 * Estratégia:
 * 1. Buscar todos os tickets da conexão ordenados por updatedAt (mais recentes primeiro)
 * 2. Para cada ticket, adicionar à fila de importação com delay
 * 3. Emitir progresso via Socket.IO
 * 4. Não processa mais de 1 ticket por vez (sequencial)
 */
const SyncFullHistoryService = async ({
  whatsappId,
  companyId,
  periodMonths = 0,
  downloadMedia = false
}: SyncFullHistoryParams): Promise<{ success: boolean; message: string; totalTickets: number }> => {
  const io = getIO();
  const namespace = `/workspace-${companyId}`;

  logger.info(`[SyncFullHistory] Iniciando sync para whatsappId=${whatsappId}, periodMonths=${periodMonths}`);

  // Verificar se já existe sync em andamento
  const existingProgress = syncProgressMap.get(whatsappId);
  if (existingProgress && existingProgress.status === "syncing") {
    logger.warn(`[SyncFullHistory] Sync já em andamento para whatsappId=${whatsappId}`);
    return {
      success: false,
      message: "Sincronização já em andamento",
      totalTickets: 0
    };
  }

  // Verificar se a conexão está ativa
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    return {
      success: false,
      message: "Conexão não encontrada",
      totalTickets: 0
    };
  }

  if (whatsapp.status !== "CONNECTED") {
    return {
      success: false,
      message: "Conexão não está ativa",
      totalTickets: 0
    };
  }

  if (whatsapp.channelType === "official") {
    return {
      success: false,
      message: "API Oficial não suporta sync de histórico",
      totalTickets: 0
    };
  }

  // Verificar se o socket está funcional
  const wbot = await getWbotOrRecover(whatsappId, 10000);
  if (!wbot) {
    return {
      success: false,
      message: "Sessão WhatsApp não disponível",
      totalTickets: 0
    };
  }

  try {
    // Inicializar progresso
    const progress: SyncProgress = {
      whatsappId,
      status: "preparing",
      totalTickets: 0,
      processedTickets: 0,
      currentTicketId: null,
      currentTicketName: null,
      startedAt: new Date()
    };
    syncProgressMap.set(whatsappId, progress);

    // Emitir status inicial
    io.of(namespace).emit(`sync-progress-${whatsappId}`, {
      action: "update",
      progress
    });

    // Buscar todos os tickets da conexão
    // Ordenar por updatedAt DESC (mais recentes primeiro) para priorizar conversas atuais
    const tickets = await Ticket.findAll({
      where: {
        whatsappId,
        companyId
      },
      attributes: ["id", "status", "updatedAt", "contactId"],
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number"]
        }
      ],
      order: [["updatedAt", "DESC"]]
    });

    progress.totalTickets = tickets.length;
    progress.status = "syncing";

    logger.info(`[SyncFullHistory] Encontrados ${tickets.length} tickets para sincronizar`);

    // Emitir progresso
    io.of(namespace).emit(`sync-progress-${whatsappId}`, {
      action: "update",
      progress
    });

    if (tickets.length === 0) {
      progress.status = "completed";
      syncProgressMap.set(whatsappId, progress);
      
      io.of(namespace).emit(`sync-progress-${whatsappId}`, {
        action: "update",
        progress
      });

      return {
        success: true,
        message: "Nenhum ticket encontrado para sincronizar",
        totalTickets: 0
      };
    }

    // Processar tickets de forma sequencial com delay
    // Delay de 2 segundos entre cada ticket para evitar sobrecarga
    const DELAY_BETWEEN_TICKETS_MS = 2000;
    let processedCount = 0;

    for (const ticket of tickets) {
      // Verificar se o sync foi cancelado (progresso removido)
      if (!syncProgressMap.has(whatsappId)) {
        logger.info(`[SyncFullHistory] Sync cancelado para whatsappId=${whatsappId}`);
        return {
          success: false,
          message: "Sincronização cancelada",
          totalTickets: processedCount
        };
      }

      // Atualizar progresso
      progress.currentTicketId = ticket.id;
      progress.currentTicketName = ticket.contact?.name || ticket.contact?.number || `Ticket ${ticket.id}`;
      progress.processedTickets = processedCount;

      // Calcular tempo estimado restante
      const elapsedMs = Date.now() - progress.startedAt.getTime();
      const avgTimePerTicket = processedCount > 0 ? elapsedMs / processedCount : DELAY_BETWEEN_TICKETS_MS;
      const remainingTickets = tickets.length - processedCount;
      progress.estimatedTimeRemaining = Math.round((remainingTickets * avgTimePerTicket) / 1000);

      syncProgressMap.set(whatsappId, progress);

      // Emitir progresso a cada 5 tickets ou no primeiro/último
      if (processedCount % 5 === 0 || processedCount === 0 || processedCount === tickets.length - 1) {
        io.of(namespace).emit(`sync-progress-${whatsappId}`, {
          action: "update",
          progress
        });
      }

      // Adicionar à fila de importação
      try {
        await queueImportHistory({
          ticketId: ticket.id,
          companyId,
          periodMonths,
          downloadMedia,
          requestedBy: "sync_full_history"
        });
      } catch (err: any) {
        logger.warn(`[SyncFullHistory] Erro ao adicionar ticket ${ticket.id} à fila: ${err?.message}`);
        // Continua com próximo ticket
      }

      processedCount++;

      // Delay entre tickets para evitar sobrecarga
      if (processedCount < tickets.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TICKETS_MS));
      }
    }

    // Finalizar sync
    progress.status = "completed";
    progress.processedTickets = processedCount;
    progress.currentTicketId = null;
    progress.currentTicketName = null;
    progress.estimatedTimeRemaining = 0;
    syncProgressMap.set(whatsappId, progress);

    io.of(namespace).emit(`sync-progress-${whatsappId}`, {
      action: "update",
      progress
    });

    logger.info(`[SyncFullHistory] Sync concluído para whatsappId=${whatsappId}. ${processedCount} tickets processados.`);

    // Limpar progresso após 1 hora
    setTimeout(() => {
      syncProgressMap.delete(whatsappId);
    }, 60 * 60 * 1000);

    return {
      success: true,
      message: "Sincronização concluída com sucesso",
      totalTickets: processedCount
    };

  } catch (err: any) {
    logger.error(`[SyncFullHistory] Erro no sync para whatsappId=${whatsappId}: ${err?.message}`);

    const progress = syncProgressMap.get(whatsappId);
    if (progress) {
      progress.status = "error";
      progress.error = err?.message || "Erro desconhecido";
      syncProgressMap.set(whatsappId, progress);

      io.of(namespace).emit(`sync-progress-${whatsappId}`, {
        action: "update",
        progress
      });
    }

    return {
      success: false,
      message: err?.message || "Erro ao sincronizar histórico",
      totalTickets: 0
    };
  }
};

export default SyncFullHistoryService;
