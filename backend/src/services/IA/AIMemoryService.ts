/**
 * AIMemoryService.ts
 * 
 * Contexto de Longo Prazo (Memory) para IA:
 * - Resumo automático de conversas
 * - Facts extraction
 * - Cross-ticket memory
 * - Memória semântica com embeddings
 */

import logger from "../../utils/logger";

interface MemoryEntry {
  contactId: number;
  companyId: number;
  type: "fact" | "preference" | "summary" | "context";
  key: string;
  value: string;
  confidence: number;
  sourceTicketId?: number;
  sourceConversationId?: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface ConversationSummary {
  contactId: number;
  companyId: number;
  ticketId: number;
  summary: string;
  keyPoints: string[];
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
  createdAt: Date;
}

class AIMemoryService {
  /**
   * Extrair facts de uma mensagem/conversa
   */
  async extractFacts(
    messages: { role: string; content: string }[],
    context: { contactId: number; companyId: number; ticketId: number }
  ): Promise<MemoryEntry[]> {
    const facts: MemoryEntry[] = [];

    // Patterns para extração de facts brasileiros
    const patterns = [
      // Preferências
      { type: "preference", regex: /(?:prefiro|gosto de|não gosto|odeio)\s+(.+?)(?:\.|,|;|$)/i },
      // Horários
      { type: "fact", regex: /(?:melhor hor[áa]rio|dispon[íi]vel|atendo)\s+(?:[áa]s?|de|das?)\s*(\d{1,2}(?::\d{2})?\s*(?:hs?|horas?|am|pm)?)/i },
      // Produtos mencionados
      { type: "fact", regex: /(?:interessado em|quero|preciso de|busco)\s+(.+?)(?:\.|,|;|$)/i },
      // Localização
      { type: "fact", regex: /(?:moro em|fico em|localizado em|sou de)\s+(.+?)(?:\.|,|;|$)/i },
      // Urgência
      { type: "fact", regex: /(?:urgente|emerg[êe]ncia|preciso logo|o mais r[áa]pido)/i }
    ];

    for (const message of messages) {
      if (message.role !== "user") continue;

      for (const pattern of patterns) {
        const match = message.content.match(pattern.regex);
        if (match) {
          facts.push({
            contactId: context.contactId,
            companyId: context.companyId,
            type: pattern.type as any,
            key: this.generateFactKey(match[1] || message.content),
            value: match[1] || message.content,
            confidence: 0.8,
            sourceTicketId: context.ticketId,
            createdAt: new Date(),
            expiresAt: this.calculateExpiry(pattern.type)
          });
        }
      }
    }

    return facts;
  }

  /**
   * Gerar resumo de conversa via LLM
   */
  async summarizeConversation(
    messages: { role: string; content: string }[],
    context: { contactId: number; companyId: number; ticketId: number }
  ): Promise<ConversationSummary> {
    // Implementação simplificada - em produção usaria LLM
    const userMessages = messages.filter(m => m.role === "user");
    const assistantMessages = messages.filter(m => m.role === "assistant");

    const summary = this.generateSimpleSummary(userMessages, assistantMessages);
    const topics = this.extractTopics(userMessages);
    const sentiment = this.analyzeSentiment(userMessages);

    return {
      contactId: context.contactId,
      companyId: context.companyId,
      ticketId: context.ticketId,
      summary,
      keyPoints: this.extractKeyPoints(messages),
      sentiment,
      topics,
      createdAt: new Date()
    };
  }

  /**
   * Buscar memória relevante para contexto
   */
  async getRelevantMemory(
    contactId: number,
    companyId: number,
    currentContext?: string
  ): Promise<MemoryEntry[]> {
    const { default: AIMemory } = await import("../../models/AIMemory");

    const memories = await AIMemory.findAll({
      where: {
        contactId,
        companyId,
        expiresAt: { $or: [{ $gt: new Date() }, { $eq: null }] }
      },
      order: [["confidence", "DESC"], ["createdAt", "DESC"]],
      limit: 10
    });

    return memories.map(m => m.toJSON());
  }

  /**
   * Salvar memória
   */
  async saveMemory(entry: MemoryEntry): Promise<void> {
    const { default: AIMemory } = await import("../../models/AIMemory");

    // Verificar se já existe fact similar
    const existing = await AIMemory.findOne({
      where: {
        contactId: entry.contactId,
        companyId: entry.companyId,
        key: entry.key
      }
    });

    if (existing) {
      // Atualizar se nova confiança for maior
      if (entry.confidence > existing.confidence) {
        await existing.update({
          value: entry.value,
          confidence: entry.confidence,
          sourceTicketId: entry.sourceTicketId,
          createdAt: new Date()
        });
      }
    } else {
      await AIMemory.create(entry);
    }

    logger.debug(`[AIMemory] Fact salvo: ${entry.key} para contact ${entry.contactId}`);
  }

  /**
   * Buscar cross-ticket memory (memória de outros tickets do mesmo contato)
   */
  async getCrossTicketMemory(
    contactId: number,
    companyId: number,
    excludeTicketId?: number
  ): Promise<{ summaries: ConversationSummary[]; facts: MemoryEntry[] }> {
    const { default: AIMemory } = await import("../../models/AIMemory");
    const { default: ConversationSummary } = await import("../../models/ConversationSummary");

    const [summaries, facts] = await Promise.all([
      ConversationSummary.findAll({
        where: {
          contactId,
          companyId,
          ...(excludeTicketId && { ticketId: { $ne: excludeTicketId } })
        },
        order: [["createdAt", "DESC"]],
        limit: 5
      }),
      AIMemory.findAll({
        where: {
          contactId,
          companyId,
          type: "fact"
        },
        order: [["createdAt", "DESC"]],
        limit: 10
      })
    ]);

    return {
      summaries: summaries.map(s => s.toJSON()),
      facts: facts.map(f => f.toJSON())
    };
  }

  /**
   * Formatar memória para injeção no prompt
   */
  formatMemoryForPrompt(memory: { facts: MemoryEntry[]; summaries: ConversationSummary[] }): string {
    const lines: string[] = [];

    if (memory.facts.length > 0) {
      lines.push("## Informações conhecidas sobre o cliente:");
      memory.facts.forEach(fact => {
        lines.push(`- ${fact.value}`);
      });
    }

    if (memory.summaries.length > 0) {
      lines.push("\n## Resumo de conversas anteriores:");
      memory.summaries.forEach((summary, idx) => {
        lines.push(`${idx + 1}. ${summary.summary.substring(0, 100)}...`);
      });
    }

    return lines.join("\n");
  }

  // Helpers privados

  private generateFactKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 50);
  }

  private calculateExpiry(type: string): Date {
    const now = new Date();
    switch (type) {
      case "preference":
        now.setFullYear(now.getFullYear() + 1);
        break;
      case "fact":
        now.setMonth(now.getMonth() + 6);
        break;
      default:
        now.setMonth(now.getMonth() + 3);
    }
    return now;
  }

  private generateSimpleSummary(
    userMessages: any[],
    assistantMessages: any[]
  ): string {
    const lastUser = userMessages[userMessages.length - 1]?.content || "";
    const topics = this.extractTopics(userMessages);
    
    return `Cliente discutiu sobre: ${topics.join(", ")}. Última mensagem: ${lastUser.substring(0, 100)}...`;
  }

  private extractTopics(messages: any[]): string[] {
    const topics = new Set<string>();
    const content = messages.map(m => m.content).join(" ").toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      "produto": ["produto", "item", "catálogo", "comprar", "preço"],
      "suporte": ["problema", "ajuda", "suporte", "funciona", "erro"],
      "venda": ["vender", "comprar", "pedido", "orçamento", "proposta"],
      "entrega": ["entrega", "frete", "envio", "prazo", "receber"],
      "pagamento": ["pagamento", "boleto", "cartão", "pix", "dinheiro"]
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => content.includes(k))) {
        topics.add(topic);
      }
    }

    return Array.from(topics);
  }

  private analyzeSentiment(messages: any[]): "positive" | "neutral" | "negative" {
    const content = messages.map(m => m.content).join(" ").toLowerCase();
    
    const positiveWords = ["obrigado", "bom", "excelente", "ótimo", "gostei", "perfeito"];
    const negativeWords = ["ruim", "péssimo", "odeio", "problema", "não funciona", "lento"];

    let score = 0;
    positiveWords.forEach(w => { if (content.includes(w)) score++; });
    negativeWords.forEach(w => { if (content.includes(w)) score--; });

    if (score > 0) return "positive";
    if (score < 0) return "negative";
    return "neutral";
  }

  private extractKeyPoints(messages: any[]): string[] {
    const points: string[] = [];
    
    // Extrair perguntas
    messages.forEach(m => {
      if (m.role === "user" && m.content.includes("?")) {
        points.push(`Pergunta: ${m.content.substring(0, 50)}...`);
      }
    });

    return points.slice(0, 3);
  }

  /**
   * Cleanup de memórias expiradas
   */
  async cleanup(): Promise<number> {
    const { default: AIMemory } = await import("../../models/AIMemory");
    const { default: ConversationSummary } = await import("../../models/ConversationSummary");

    const now = new Date();

    const [memoriesDeleted, summariesDeleted] = await Promise.all([
      AIMemory.destroy({
        where: { expiresAt: { $lt: now } }
      }),
      ConversationSummary.destroy({
        where: { createdAt: { $lt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) } } // 1 ano
      })
    ]);

    logger.info(`[AIMemory] Cleanup: ${memoriesDeleted} facts, ${summariesDeleted} summaries removidos`);
    return memoriesDeleted + summariesDeleted;
  }
}

export const aiMemory = new AIMemoryService();
export default aiMemory;
