import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageStatsParams {
  ticketId?: number;
  contactId?: number;
  companyId: number;
  period?: number; // dias (padrão: 30)
  includeMedia?: boolean;
}

interface MessageStatsResult {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  mediaMessages: number;
  textMessages: number;
  averagePerDay: number;
  firstMessageDate: Date | null;
  lastMessageDate: Date | null;
  mostActiveDay: string;
  mostActiveHour: number;
  mediaBreakdown: {
    images: number;
    videos: number;
    audios: number;
    documents: number;
    stickers: number;
    others: number;
  };
  dailyActivity: Array<{
    date: string;
    sent: number;
    received: number;
    total: number;
  }>;
  hourlyActivity: Array<{
    hour: number;
    count: number;
  }>;
  topWords: Array<{
    word: string;
    count: number;
  }>;
  responseTimeStats?: {
    averageResponseTime: number; // em minutos
    fastestResponse: number;
    slowestResponse: number;
  };
}

const MessageStatsService = async ({
  ticketId,
  contactId,
  companyId,
  period = 30,
  includeMedia = true
}: MessageStatsParams): Promise<MessageStatsResult> => {
  try {
    logger.info(`Gerando estatísticas de mensagens - Ticket: ${ticketId}, Contact: ${contactId}, Período: ${period} dias`);

    // Definir período de análise
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, period));

    // Construir filtros
    const whereClause: any = {
      companyId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      isDeleted: false
    };

    if (ticketId) {
      whereClause.ticketId = ticketId;
    } else if (contactId) {
      // Se contactId fornecido, buscar todos tickets deste contato
      const contactTickets = await Ticket.findAll({
        where: { contactId, companyId },
        attributes: ["id"]
      });
      whereClause.ticketId = { [Op.in]: contactTickets.map(t => t.id) };
    }

    // Buscar todas as mensagens do período
    const messages = await Message.findAll({
      where: whereClause,
      attributes: [
        "id", "body", "fromMe", "mediaType", "mediaUrl", 
        "createdAt", "ack", "contactId", "ticketId"
      ],
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["name"]
        }
      ],
      order: [["createdAt", "ASC"]]
    });

    if (messages.length === 0) {
      return {
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        mediaMessages: 0,
        textMessages: 0,
        averagePerDay: 0,
        firstMessageDate: null,
        lastMessageDate: null,
        mostActiveDay: "",
        mostActiveHour: 0,
        mediaBreakdown: {
          images: 0,
          videos: 0,
          audios: 0,
          documents: 0,
          stickers: 0,
          others: 0
        },
        dailyActivity: [],
        hourlyActivity: [],
        topWords: [],
        responseTimeStats: {
          averageResponseTime: 0,
          fastestResponse: 0,
          slowestResponse: 0
        }
      };
    }

    // Cálculos básicos
    const totalMessages = messages.length;
    const sentMessages = messages.filter(m => m.fromMe).length;
    const receivedMessages = totalMessages - sentMessages;
    const mediaMessages = messages.filter(m => m.mediaUrl && m.mediaUrl.trim() !== "").length;
    const textMessages = totalMessages - mediaMessages;

    const firstMessageDate = messages[0].createdAt;
    const lastMessageDate = messages[messages.length - 1].createdAt;
    const averagePerDay = totalMessages / period;

    // Breakdown de mídia
    const mediaBreakdown = {
      images: messages.filter(m => m.mediaType === "image").length,
      videos: messages.filter(m => m.mediaType === "video").length,
      audios: messages.filter(m => ["audio", "ptt", "voiceMessage"].includes(m.mediaType)).length,
      documents: messages.filter(m => m.mediaType === "document").length,
      stickers: messages.filter(m => m.mediaType === "sticker").length,
      others: messages.filter(m => 
        m.mediaUrl && !["image", "video", "audio", "ptt", "voiceMessage", "document", "sticker"].includes(m.mediaType)
      ).length
    };

    // Atividade diária
    const dailyStats = new Map();
    messages.forEach(message => {
      const dateKey = format(message.createdAt, "yyyy-MM-dd");
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, { sent: 0, received: 0, total: 0 });
      }
      const stats = dailyStats.get(dateKey);
      if (message.fromMe) {
        stats.sent++;
      } else {
        stats.received++;
      }
      stats.total++;
    });

    const dailyActivity = Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date: format(new Date(date), "dd/MM", { locale: ptBR }),
      ...stats
    }));

    // Dia mais ativo
    const mostActiveDayEntry = Array.from(dailyStats.entries())
      .reduce((max, current) => current[1].total > max[1].total ? current : max);
    const mostActiveDay = format(new Date(mostActiveDayEntry[0]), "dd/MM/yyyy", { locale: ptBR });

    // Atividade por hora
    const hourlyStats = new Array(24).fill(0);
    messages.forEach(message => {
      const hour = message.createdAt.getHours();
      hourlyStats[hour]++;
    });

    const hourlyActivity = hourlyStats.map((count, hour) => ({ hour, count }));
    const mostActiveHour = hourlyStats.indexOf(Math.max(...hourlyStats));

    // Top palavras (apenas mensagens de texto)
    const wordCounts = new Map();
    const stopWords = new Set([
      "a", "o", "e", "de", "do", "da", "em", "um", "uma", "para", "com", "não", "que", "se", "por", "mais", 
      "como", "mas", "foi", "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", 
      "há", "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso", "ela", "entre", "era", 
      "depois", "sem", "mesmo", "aos", "ter", "seus", "suas", "numa", "pelos", "pelas", "esse", "eles", 
      "havia", "seja", "qual", "será", "nós", "tenho", "lhe", "deles", "essas", "esses", "pelas", "este", 
      "fosse", "dele", "tu", "te", "vocês", "vos", "lhes", "meus", "minhas", "teu", "tua", "nosso", "nossa",
      "aquele", "aquela", "aqueles", "aquelas", "isto", "aquilo", "estou", "está", "estamos", "estão",
      "fui", "foi", "fomos", "foram", "era", "eram", "fora", "sejam", "fossem", "tivesse", "tivessem"
    ]);

    messages
      .filter(m => !m.fromMe && m.body && typeof m.body === "string" && m.body.length > 2)
      .forEach(message => {
        const words = message.body
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.has(word));
        
        words.forEach(word => {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        });
      });

    const topWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Estatísticas de tempo de resposta
    let responseTimeStats = {
      averageResponseTime: 0,
      fastestResponse: 0,
      slowestResponse: 0
    };

    if (sentMessages > 0 && receivedMessages > 0) {
      const responseTimes: number[] = [];
      
      for (let i = 1; i < messages.length; i++) {
        const currentMsg = messages[i];
        const previousMsg = messages[i - 1];
        
        // Se mensagem atual é enviada e anterior é recebida
        if (currentMsg.fromMe && !previousMsg.fromMe) {
          const timeDiff = (currentMsg.createdAt.getTime() - previousMsg.createdAt.getTime()) / 1000 / 60; // em minutos
          if (timeDiff <= 1440) { // Apenas respostas dentro de 24 horas
            responseTimes.push(timeDiff);
          }
        }
      }

      if (responseTimes.length > 0) {
        const avgResponse = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        const fastestResponse = Math.min(...responseTimes);
        const slowestResponse = Math.max(...responseTimes);

        responseTimeStats = {
          averageResponseTime: Math.round(avgResponse * 10) / 10,
          fastestResponse: Math.round(fastestResponse * 10) / 10,
          slowestResponse: Math.round(slowestResponse * 10) / 10
        };
      }
    }

    logger.info(`Estatísticas geradas: ${totalMessages} mensagens analisadas`);

    return {
      totalMessages,
      sentMessages,
      receivedMessages,
      mediaMessages,
      textMessages,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      firstMessageDate,
      lastMessageDate,
      mostActiveDay,
      mostActiveHour,
      mediaBreakdown,
      dailyActivity,
      hourlyActivity,
      topWords,
      responseTimeStats
    };

  } catch (error: any) {
    logger.error(`Erro ao gerar estatísticas de mensagens: ${error.message}`);
    throw error;
  }
};

export default MessageStatsService;
