import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import ImportContactHistoryService from "./ImportContactHistoryService";

interface ResyncTicketMessagesParams {
  ticketId: string | number;
  companyId: number;
  periodMonths?: number;
}

interface ResyncResult {
  existing: number;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Ressincroniza mensagens de um ticket SEM apagar o histórico existente
 * Mantém todas as mensagens atuais e apenas adiciona o que falta do WhatsApp
 */
const ResyncTicketMessagesService = async ({
  ticketId,
  companyId,
  periodMonths = 0
}: ResyncTicketMessagesParams): Promise<ResyncResult> => {
  try {
    // 1. Verificar se o ticket existe e pertence à empresa
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Whatsapp, as: 'whatsapp' }
      ]
    });
    
    if (!ticket) {
      return { existing: 0, success: false, error: "Ticket não encontrado" };
    }

    if (ticket.companyId !== companyId) {
      return { existing: 0, success: false, error: "Ticket não pertence a esta empresa" };
    }

    // 2. Contar mensagens existentes (sem deletar)
    const existing = await Message.count({
      where: { ticketId, companyId }
    });

    logger.info(`[ResyncTicketMessages] TicketId=${ticketId} possui ${existing} mensagens existentes`);

    // 3. Verificar se conexão WhatsApp está ativa
    if (!ticket.whatsapp || ticket.whatsapp.status !== "CONNECTED") {
      return { 
        existing, 
        success: false, 
        error: "Conexão WhatsApp não está ativa" 
      };
    }

    // 4. Verificar se o canal suporta ressincronização
    if (ticket.channel !== "whatsapp") {
      return { 
        existing, 
        success: false, 
        error: "Canal não suportado para ressincronização" 
      };
    }

    // 5. Iniciar importação completa em background (sem deletar nada)
    logger.info(`[ResyncTicketMessages] Iniciando ressincronização completa para ticketId=${ticketId}, período=${periodMonths} meses`);

    // Emitir evento de início para UI
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-resync`, {
      action: "resync_started",
      ticketId,
      existing,
      periodMonths
    });

    // Executar ImportContactHistoryService em background
    // Este serviço já verifica duplicatas automaticamente pelo wid
    ImportContactHistoryService({
      ticketId,
      companyId,
      periodMonths
    }).then((result) => {
      logger.info(`[ResyncTicketMessages] Ressincronização concluída: ${result.synced} novas mensagens`);
      
      // Emitir evento de conclusão
      io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-resync`, {
        action: "resync_completed",
        ticketId,
        existing,
        synced: result.synced,
        skipped: result.skipped
      });

      // Atualizar ticket na UI
      io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    }).catch((err: any) => {
      logger.error(`[ResyncTicketMessages] Erro na ressincronização: ${err?.message}`);
      
      // Emitir evento de erro
      io.of(`/workspace-${companyId}`).emit(`ticket-${ticketId}-resync`, {
        action: "resync_error",
        ticketId,
        error: err?.message
      });
    });

    return { 
      existing, 
      success: true, 
      message: `Ressincronização iniciada. ${existing} mensagens existentes preservadas.` 
    };

  } catch (err: any) {
    logger.error(`[ResyncTicketMessages] Erro geral: ${err?.message}`);
    return { existing: 0, success: false, error: `Erro: ${err?.message}` };
  }
};

export default ResyncTicketMessagesService;
