import sequelize from "../../database";
import { indexTextDocument } from "./RAGIndexService";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import { Op } from "sequelize";

/**
 * Serviço para auto-indexação de conversas históricas no RAG
 */

export interface AutoIndexOptions {
  companyId: number;
  batchSize?: number;
  maxMessages?: number;
  onlyResolved?: boolean;
  minMessageLength?: number;
  excludeMediaMessages?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AutoIndexResult {
  ticketsProcessed: number;
  messagesIndexed: number;
  documentsCreated: number;
  errors: string[];
  processingTime: number;
}

export default class AutoIndexService {
  /**
   * Indexa conversas históricas automaticamente
   */
  static async indexHistoricalConversations(options: AutoIndexOptions): Promise<AutoIndexResult> {
    const startTime = Date.now();
    const {
      companyId,
      batchSize = 50,
      maxMessages = 1000,
      onlyResolved = true,
      minMessageLength = 20,
      excludeMediaMessages = true,
      dateFrom,
      dateTo
    } = options;

    console.log(`[AutoIndex] Starting historical indexing for company ${companyId}`);

    const result: AutoIndexResult = {
      ticketsProcessed: 0,
      messagesIndexed: 0,
      documentsCreated: 0,
      errors: [],
      processingTime: 0
    };

    try {
      // Busca tickets elegíveis
      const whereClause: any = { companyId };
      
      if (onlyResolved) {
        whereClause.status = 'closed';
      }
      
      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt[Op.gte] = dateFrom;
        if (dateTo) whereClause.createdAt[Op.lte] = dateTo;
      }

      const tickets = await Ticket.findAll({
        where: whereClause,
        include: [
          { model: Contact, as: "contact" },
          { model: Queue, as: "queue" }
        ],
        order: [["updatedAt", "DESC"]],
        limit: batchSize
      });

      console.log(`[AutoIndex] Found ${tickets.length} tickets to process`);

      // Processa cada ticket
      for (const ticket of tickets) {
        try {
          await this.indexTicketConversation(ticket, {
            companyId,
            maxMessages,
            minMessageLength,
            excludeMediaMessages
          });
          
          result.ticketsProcessed++;
          
        } catch (error: any) {
          console.error(`[AutoIndex] Failed to index ticket ${ticket.id}:`, error.message);
          result.errors.push(`Ticket ${ticket.id}: ${error.message}`);
        }
      }

      result.processingTime = Date.now() - startTime;
      
      console.log(`[AutoIndex] Completed: ${result.ticketsProcessed} tickets processed in ${result.processingTime}ms`);
      
      return result;

    } catch (error: any) {
      console.error("[AutoIndex] Fatal error:", error);
      result.errors.push(`Fatal error: ${error.message}`);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Indexa a conversa de um ticket específico
   */
  private static async indexTicketConversation(
    ticket: any, 
    options: {
      companyId: number;
      maxMessages: number;
      minMessageLength: number;
      excludeMediaMessages: boolean;
    }
  ): Promise<void> {
    const { companyId, maxMessages, minMessageLength, excludeMediaMessages } = options;

    // Busca mensagens do ticket
    const whereClause: any = { ticketId: ticket.id };
    
    if (excludeMediaMessages) {
      whereClause.mediaType = { [Op.or]: [null, 'text'] };
    }

    const messages = await Message.findAll({
      where: whereClause,
      order: [["createdAt", "ASC"]],
      limit: maxMessages
    });

    if (messages.length === 0) {
      console.log(`[AutoIndex] No messages found for ticket ${ticket.id}`);
      return;
    }

    // Constrói o texto da conversa
    const conversationText = this.buildConversationText(messages, minMessageLength);
    
    if (conversationText.length < 100) {
      console.log(`[AutoIndex] Conversation too short for ticket ${ticket.id}: ${conversationText.length} chars`);
      return;
    }

    // Gera título e tags
    const title = this.generateConversationTitle(ticket, messages);
    const tags = this.generateConversationTags(ticket, messages);

    // Indexa no RAG
    await indexTextDocument({
      companyId,
      title,
      text: conversationText,
      tags,
      source: `ticket:${ticket.id}`,
      mimeType: 'text/conversation'
    });

    console.log(`[AutoIndex] Indexed ticket ${ticket.id}: ${conversationText.length} chars, ${messages.length} messages`);
  }

  /**
   * Constrói texto da conversa formatado
   */
  private static buildConversationText(messages: any[], minMessageLength: number): string {
    const conversationLines: string[] = [];
    
    for (const message of messages) {
      if (!message.body || message.body.length < minMessageLength) {
        continue;
      }

      // Determina o remetente
      const sender = message.fromMe ? 'Atendente' : 'Cliente';
      const timestamp = new Date(message.createdAt).toLocaleString('pt-BR');
      
      // Limpa o texto da mensagem
      const cleanBody = message.body
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      conversationLines.push(`[${timestamp}] ${sender}: ${cleanBody}`);
    }

    return conversationLines.join('\n');
  }

  /**
   * Gera título para a conversa
   */
  private static generateConversationTitle(ticket: any, messages: any[]): string {
    const contact = ticket.contact;
    const queue = ticket.queue;
    const date = new Date(ticket.createdAt).toLocaleDateString('pt-BR');
    
    let title = `Conversa - ${contact?.name || 'Cliente'} - ${date}`;
    
    if (queue?.name) {
      title += ` - ${queue.name}`;
    }
    
    // Adiciona resumo do primeiro problema se possível
    const firstMessage = messages.find(m => !m.fromMe && m.body && m.body.length > 20);
    if (firstMessage) {
      const summary = firstMessage.body.substring(0, 50).trim();
      title += ` - ${summary}...`;
    }
    
    return title;
  }

  /**
   * Gera tags para a conversa
   */
  private static generateConversationTags(ticket: any, messages: any[]): string[] {
    const tags: string[] = [
      'conversation',
      'historical',
      `status:${ticket.status}`,
      `ticket:${ticket.id}`
    ];

    // Tags do contato
    if (ticket.contact?.name) {
      tags.push(`contact:${ticket.contact.name}`);
    }

    // Tags da fila
    if (ticket.queue?.name) {
      tags.push(`queue:${ticket.queue.name}`);
    }

    // Tags baseadas no conteúdo
    const allText = messages.map(m => m.body || '').join(' ').toLowerCase();
    
    // Detecta temas comuns
    const themes = [
      { keyword: ['problema', 'erro', 'bug'], tag: 'issue' },
      { keyword: ['dúvida', 'pergunta', 'como'], tag: 'question' },
      { keyword: ['reclamação', 'insatisfeito'], tag: 'complaint' },
      { keyword: ['elogio', 'parabéns', 'obrigado'], tag: 'compliment' },
      { keyword: ['cancelar', 'cancelamento'], tag: 'cancellation' },
      { keyword: ['pagamento', 'cobrança', 'fatura'], tag: 'billing' },
      { keyword: ['produto', 'serviço'], tag: 'product' },
      { keyword: ['suporte', 'ajuda', 'apoio'], tag: 'support' }
    ];

    for (const theme of themes) {
      if (theme.keyword.some(keyword => allText.includes(keyword))) {
        tags.push(theme.tag);
      }
    }

    // Tag de período
    const date = new Date(ticket.createdAt);
    tags.push(`year:${date.getFullYear()}`);
    tags.push(`month:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);

    return tags;
  }

  /**
   * Indexa conversas de um período específico
   */
  static async indexConversationsByDateRange(
    companyId: number,
    startDate: Date,
    endDate: Date,
    options?: Partial<AutoIndexOptions>
  ): Promise<AutoIndexResult> {
    return await this.indexHistoricalConversations({
      companyId,
      dateFrom: startDate,
      dateTo: endDate,
      ...options
    });
  }

  /**
   * Indexa conversas recentes (últimos N dias)
   */
  static async indexRecentConversations(
    companyId: number,
    days: number = 7,
    options?: Partial<AutoIndexOptions>
  ): Promise<AutoIndexResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.indexConversationsByDateRange(companyId, startDate, endDate, options);
  }

  /**
   * Obtém estatísticas de conversas indexáveis
   */
  static async getIndexableStats(companyId: number): Promise<{
    totalTickets: number;
    resolvedTickets: number;
    totalMessages: number;
    avgMessagesPerTicket: number;
    oldestTicket: Date | null;
    newestTicket: Date | null;
  }> {
    try {
      const [totalTickets, resolvedTickets] = await Promise.all([
        Ticket.count({ where: { companyId } }),
        Ticket.count({ where: { companyId, status: 'closed' } })
      ]);

      const totalMessages = await Message.count({
        include: [{
          model: Ticket,
          as: 'ticket',
          where: { companyId },
          attributes: []
        }]
      });

      const avgMessagesPerTicket = totalTickets > 0 ? Math.round(totalMessages / totalTickets) : 0;

      const [oldestTicket, newestTicket] = await Promise.all([
        Ticket.findOne({
          where: { companyId },
          order: [['createdAt', 'ASC']],
          attributes: ['createdAt']
        }),
        Ticket.findOne({
          where: { companyId },
          order: [['createdAt', 'DESC']],
          attributes: ['createdAt']
        })
      ]);

      return {
        totalTickets,
        resolvedTickets,
        totalMessages,
        avgMessagesPerTicket,
        oldestTicket: oldestTicket?.createdAt || null,
        newestTicket: newestTicket?.createdAt || null
      };

    } catch (error: any) {
      console.error("[AutoIndex] Error getting stats:", error);
      throw error;
    }
  }
}
