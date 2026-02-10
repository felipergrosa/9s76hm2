import { Op, Sequelize } from "sequelize";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import logger from "../../utils/logger";

interface MergeResult {
  contactId: number;
  contactName: string;
  keptTicketId: number;
  mergedTicketIds: number[];
  messagesMoved: number;
}

interface Request {
  companyId: number;
  whatsappId?: number; // Opcional - se não informar, processa todos
  dryRun?: boolean; // Se true, só mostra o que seria feito sem executar
  statusFilter?: string[]; // Status dos tickets a processar (default: pending, open)
}

/**
 * Serviço para consolidar tickets duplicados de importação
 * Move mensagens de tickets duplicados para o ticket mais antigo
 */
const MergeDuplicateTicketsService = async ({
  companyId,
  whatsappId,
  dryRun = false,
  statusFilter = ["pending", "open", "group"]
}: Request): Promise<{
  success: boolean;
  message: string;
  results: MergeResult[];
  totalMerged: number;
  totalMessagesMoved: number;
}> => {
  const results: MergeResult[] = [];
  let totalMerged = 0;
  let totalMessagesMoved = 0;

  try {
    logger.info(`[MergeDuplicateTickets] Iniciando processamento para companyId=${companyId}${whatsappId ? `, whatsappId=${whatsappId}` : ''}${dryRun ? ' [DRY RUN]' : ''}`);

    // Buscar tickets duplicados (mesmo contato, mesma conexão, status similar)
    const whereClause: any = {
      companyId,
      status: { [Op.in]: statusFilter },
      imported: { [Op.ne]: null } // Só processa tickets importados
    };

    if (whatsappId) {
      whereClause.whatsappId = whatsappId;
    }

    // Buscar todos os tickets candidatos
    const tickets = await Ticket.findAll({
      where: whereClause,
      order: [["id", "ASC"]], // Mais antigo primeiro
      attributes: ["id", "contactId", "whatsappId", "status", "lastMessage", "imported"]
    });

    logger.info(`[MergeDuplicateTickets] Encontrados ${tickets.length} tickets candidatos`);

    // Agrupar por contactId + whatsappId
    const grouped = new Map<string, typeof tickets>();
    
    for (const ticket of tickets) {
      const key = `${ticket.contactId}_${ticket.whatsappId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(ticket);
    }

    // Processar grupos com mais de 1 ticket (duplicados)
    for (const [key, groupTickets] of grouped.entries()) {
      if (groupTickets.length <= 1) continue; // Não é duplicado

      const [contactId, wppId] = key.split("_").map(Number);
      
      // Ordenar por ID (mais antigo primeiro)
      groupTickets.sort((a, b) => a.id - b.id);
      
      const keptTicket = groupTickets[0]; // Mantém o mais antigo
      const duplicates = groupTickets.slice(1); // Os demais serão mesclados

      logger.info(`[MergeDuplicateTickets] Contato ${contactId}: Ticket ${keptTicket.id} (mantido), ${duplicates.length} duplicados: [${duplicates.map(d => d.id).join(', ')}]`);

      const mergedTicketIds: number[] = [];
      let messagesMoved = 0;

      for (const dup of duplicates) {
        if (dryRun) {
          // Só contar mensagens que seriam movidas
          const count = await Message.count({
            where: { ticketId: dup.id, companyId }
          });
          messagesMoved += count;
          mergedTicketIds.push(dup.id);
          totalMessagesMoved += count;
          logger.info(`[MergeDuplicateTickets] [DRY RUN] Ticket ${dup.id}: ${count} mensagens seriam movidas para ${keptTicket.id}`);
        } else {
          // Mover mensagens
          const [updatedCount] = await Message.update(
            { ticketId: keptTicket.id },
            { where: { ticketId: dup.id, companyId } }
          );
          messagesMoved += updatedCount;
          totalMessagesMoved += updatedCount;

          logger.info(`[MergeDuplicateTickets] Movidas ${updatedCount} mensagens do ticket ${dup.id} para ${keptTicket.id}`);

          // Atualizar TicketTraking se existir
          await TicketTraking.update(
            { ticketId: keptTicket.id },
            { where: { ticketId: dup.id, companyId } }
          );

          // Fechar ticket duplicado
          await dup.update({
            status: "closed",
            lastMessage: `Mesclado com ticket #${keptTicket.id}`
          });

          mergedTicketIds.push(dup.id);
          totalMerged++;
        }
      }

      if (!dryRun && messagesMoved > 0) {
        // Atualizar lastMessage do ticket mantido
        const lastMsg = await Message.findOne({
          where: { ticketId: keptTicket.id, companyId },
          order: [["createdAt", "DESC"]],
          attributes: ["body"]
        });

        if (lastMsg) {
          await keptTicket.update({ lastMessage: lastMsg.body });
        }
      }

      results.push({
        contactId,
        contactName: `Contato ID ${contactId}`,
        keptTicketId: keptTicket.id,
        mergedTicketIds,
        messagesMoved
      });
    }

    const message = dryRun 
      ? `[DRY RUN] Seriam mesclados ${results.length} grupos de tickets, movendo ${totalMessagesMoved} mensagens`
      : `Mesclados ${totalMerged} tickets duplicados, movendo ${totalMessagesMoved} mensagens para ${results.length} tickets principais`;

    logger.info(`[MergeDuplicateTickets] Concluído: ${message}`);

    return {
      success: true,
      message,
      results,
      totalMerged,
      totalMessagesMoved
    };

  } catch (error: any) {
    logger.error(`[MergeDuplicateTickets] Erro: ${error.message}`, error);
    return {
      success: false,
      message: `Erro ao mesclar tickets: ${error.message}`,
      results,
      totalMerged,
      totalMessagesMoved
    };
  }
};

export default MergeDuplicateTicketsService;
