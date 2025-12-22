import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowTicketService from "./ShowTicketService";
import UpdateTicketService from "./UpdateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import logger from "../../utils/logger";
import { Op } from "sequelize";

interface BulkProcessOptions {
  ticketIds: number[];
  companyId: number;
  userId: number;
  
  // Opções de Resposta
  responseType: 'none' | 'standard' | 'ai';
  responseMessage?: string;
  aiAgentId?: number;
  
  // Opções de Catalogação
  kanbanLaneId?: number;
  tagIds?: number[];
  newStatus?: 'pending' | 'open' | 'closed';
  
  // Opções Adicionais
  closeTicket?: boolean;
  addNote?: string;
  queueId?: number;
}

interface TicketProcessResult {
  ticketId: number;
  success: boolean;
  error?: string;
  actions?: string[];
}

interface ProcessResult {
  total: number;
  processed: number;
  success: number;
  errors: number;
  details: TicketProcessResult[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

const BulkProcessTicketsService = async (
  options: BulkProcessOptions
): Promise<ProcessResult> => {
  const {
    ticketIds,
    companyId,
    userId,
    responseType,
    responseMessage,
    aiAgentId,
    kanbanLaneId,
    tagIds,
    newStatus,
    closeTicket,
    addNote,
    queueId
  } = options;

  const io = getIO();
  const startTime = new Date();

  // Validações iniciais
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    throw new AppError("Nenhum ticket fornecido para processamento", 400);
  }

  if (ticketIds.length > 1000) {
    throw new AppError("Limite máximo de 1000 tickets por processamento", 400);
  }

  // Validar usuário
  const user = await User.findOne({
    where: { id: userId, companyId }
  });

  if (!user) {
    throw new AppError("Usuário não encontrado", 404);
  }

  // Validar tags se fornecidas
  if (tagIds && tagIds.length > 0) {
    const tags = await Tag.findAll({
      where: {
        id: { [Op.in]: tagIds },
        companyId
      }
    });

    if (tags.length !== tagIds.length) {
      throw new AppError("Uma ou mais tags são inválidas", 400);
    }
  }

  // Validar fila se fornecida
  if (queueId) {
    const queue = await Queue.findOne({
      where: { id: queueId, companyId }
    });

    if (!queue) {
      throw new AppError("Fila não encontrada", 404);
    }
  }

  // Buscar tickets válidos
  const tickets = await Ticket.findAll({
    where: {
      id: { [Op.in]: ticketIds },
      companyId
    },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"]
      }
    ]
  });

  if (tickets.length === 0) {
    throw new AppError("Nenhum ticket válido encontrado", 404);
  }

  logger.info(`[BulkProcess] Iniciando processamento de ${tickets.length} tickets`);

  const result: ProcessResult = {
    total: tickets.length,
    processed: 0,
    success: 0,
    errors: 0,
    details: [],
    startTime
  };

  // Processar tickets em lotes de 50
  const batchSize = 50;
  const batches = [];
  
  for (let i = 0; i < tickets.length; i += batchSize) {
    batches.push(tickets.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    logger.info(`[BulkProcess] Processando lote ${batchIndex + 1}/${batches.length}`);

    // Processar tickets do lote em paralelo
    const batchPromises = batch.map(async (ticket) => {
      const ticketResult: TicketProcessResult = {
        ticketId: ticket.id,
        success: false,
        actions: []
      };

      try {
        // 1. Enviar resposta (se configurado)
        if (responseType === 'standard' && responseMessage) {
          try {
            await SendWhatsAppMessage({
              body: responseMessage,
              ticket
            });
            ticketResult.actions?.push('Resposta enviada');
          } catch (error) {
            logger.error(`[BulkProcess] Erro ao enviar mensagem para ticket ${ticket.id}:`, error);
            ticketResult.actions?.push('Erro ao enviar resposta');
          }
        }

        // 2. Enviar resposta com IA (se configurado)
        if (responseType === 'ai' && aiAgentId) {
          try {
            const SendAIResponseService = (await import("./SendAIResponseService")).default;
            const aiResult = await SendAIResponseService({ 
              ticketId: ticket.id, 
              aiAgentId, 
              companyId 
            });
            
            if (aiResult.success) {
              ticketResult.actions?.push('Resposta IA enviada');
            } else {
              ticketResult.actions?.push(`Erro IA: ${aiResult.error}`);
            }
          } catch (error) {
            logger.error(`[BulkProcess] Erro ao enviar resposta IA para ticket ${ticket.id}:`, error);
            ticketResult.actions?.push('Erro ao enviar resposta IA');
          }
        }

        // 3. Adicionar tags
        if (tagIds && tagIds.length > 0) {
          try {
            // Remover tags antigas
            await ticket.$set('tags', []);
            // Adicionar novas tags
            await ticket.$add('tags', tagIds);
            ticketResult.actions?.push(`${tagIds.length} tag(s) adicionada(s)`);
          } catch (error) {
            logger.error(`[BulkProcess] Erro ao adicionar tags ao ticket ${ticket.id}:`, error);
            ticketResult.actions?.push('Erro ao adicionar tags');
          }
        }

        // 4. Atualizar status/fila
        const updateData: any = {};
        
        if (newStatus) {
          updateData.status = newStatus;
        }

        if (queueId) {
          updateData.queueId = queueId;
        }

        // Se resposta IA, garantir modo bot
        if (responseType === 'ai') {
          updateData.isBot = true;
          if (!newStatus) {
            updateData.status = 'bot';
          }
        }

        if (closeTicket) {
          updateData.status = 'closed';
          updateData.isBot = false;
        }

        if (Object.keys(updateData).length > 0) {
          try {
            await UpdateTicketService({
              ticketData: updateData,
              ticketId: ticket.id,
              companyId
            });
            ticketResult.actions?.push('Status/fila atualizado');
          } catch (error) {
            logger.error(`[BulkProcess] Erro ao atualizar ticket ${ticket.id}:`, error);
            ticketResult.actions?.push('Erro ao atualizar status');
          }
        }

        // 5. Adicionar nota interna (se configurado)
        if (addNote) {
          try {
            await Message.create({
              body: addNote,
              ticketId: ticket.id,
              contactId: ticket.contactId,
              fromMe: true,
              read: true,
              mediaType: 'chat',
              quotedMsgId: null,
              ack: 3,
              isPrivate: true,
              companyId
            });
            ticketResult.actions?.push('Nota adicionada');
          } catch (error) {
            logger.error(`[BulkProcess] Erro ao adicionar nota ao ticket ${ticket.id}:`, error);
            ticketResult.actions?.push('Erro ao adicionar nota');
          }
        }

        ticketResult.success = true;
        result.success++;

      } catch (error: any) {
        logger.error(`[BulkProcess] Erro ao processar ticket ${ticket.id}:`, error);
        ticketResult.success = false;
        ticketResult.error = error.message || 'Erro desconhecido';
        result.errors++;
      }

      result.processed++;
      result.details.push(ticketResult);

      // Emitir progresso via Socket.IO
      const progress = Math.round((result.processed / result.total) * 100);
      io.of(String(companyId)).emit(`company-${companyId}-bulk-process-progress`, {
        userId,
        progress,
        processed: result.processed,
        total: result.total,
        success: result.success,
        errors: result.errors
      });

      return ticketResult;
    });

    // Aguardar processamento do lote
    await Promise.all(batchPromises);

    // Pequeno delay entre lotes para não sobrecarregar
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  result.endTime = new Date();
  result.duration = result.endTime.getTime() - result.startTime.getTime();

  logger.info(`[BulkProcess] Processamento concluído: ${result.success} sucesso, ${result.errors} erros em ${result.duration}ms`);

  // Emitir evento de conclusão
  io.of(String(companyId)).emit(`company-${companyId}-bulk-process-complete`, {
    userId,
    result
  });

  return result;
};

export default BulkProcessTicketsService;
