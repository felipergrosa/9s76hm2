/**
 * TrainingDatasetService.ts
 * 
 * Serviço para gerenciamento de datasets de treinamento
 * - Criação e versionamento de datasets
 * - Exportação para formatos (OpenAI, Anthropic, Gemini)
 * - Qualidade e verificação
 * - Integração com feedback do treinamento
 */

import logger from "../../utils/logger";

// Interfaces
export interface TrainingMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TrainingExample {
  messages: TrainingMessage[];
  metadata?: {
    category?: string;
    quality?: number;
    source?: "manual" | "feedback" | "conversation" | "import";
    agentId?: number;
    ticketId?: number;
    conversationId?: string;
    tags?: string[];
  };
}

export interface DatasetStats {
  totalExamples: number;
  totalTokens: number;
  avgQuality: number;
  categories: Record<string, number>;
  sources: Record<string, number>;
  verified: number;
  pending: number;
}

export type DatasetFormat = "openai" | "anthropic" | "gemini" | "llama" | "generic";

class TrainingDatasetService {
  /**
   * Criar novo dataset
   */
  async createDataset(data: {
    companyId: number;
    agentId?: number;
    name: string;
    description?: string;
    format?: DatasetFormat;
    metadata?: any;
  }): Promise<any> {
    // Importar model dinamicamente
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");

    const dataset = await TrainingDataset.create({
      ...data,
      version: "1.0.0",
      stats: {
        totalExamples: 0,
        totalTokens: 0,
        avgQuality: 0,
        categories: {}
      }
    });

    logger.info(`[TrainingDataset] Criado: ${dataset.id} - ${dataset.name}`);
    return dataset;
  }

  /**
   * Adicionar exemplo ao dataset
   */
  async addExample(
    datasetId: number,
    companyId: number,
    example: TrainingExample,
    feedbackId?: number
  ): Promise<any> {
    const { default: TrainingExampleModel } = await import("../../models/TrainingExample");
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");

    // Calcular tokens estimados (simplificado)
    const tokens = this.estimateTokens(example.messages);

    const created = await TrainingExampleModel.create({
      datasetId,
      companyId,
      messages: example.messages,
      metadata: example.metadata || {},
      source: example.metadata?.source || "manual",
      feedbackId,
      quality: example.metadata?.quality || 1.0,
      tokens
    });

    // Atualizar estatísticas do dataset
    await this.updateDatasetStats(datasetId);

    logger.info(`[TrainingDataset] Exemplo adicionado: dataset=${datasetId}`);
    return created;
  }

  /**
   * Estimar tokens (aproximação)
   */
  private estimateTokens(messages: TrainingMessage[]): number {
    // Regra simples: ~4 caracteres = 1 token
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4) + messages.length * 3; // overhead
  }

  /**
   * Atualizar estatísticas do dataset
   */
  private async updateDatasetStats(datasetId: number): Promise<void> {
    const { default: TrainingExample } = await import("../../models/TrainingExample");
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");

    const examples = await TrainingExample.findAll({
      where: { datasetId }
    });

    const stats: DatasetStats = {
      totalExamples: examples.length,
      totalTokens: examples.reduce((sum, e) => sum + (e.tokens || 0), 0),
      avgQuality: examples.length > 0
        ? examples.reduce((sum, e) => sum + (e.quality || 0), 0) / examples.length
        : 0,
      categories: {},
      sources: {},
      verified: examples.filter(e => e.isVerified).length,
      pending: examples.filter(e => !e.isVerified).length
    };

    // Agrupar por categoria
    examples.forEach(e => {
      const cat = e.metadata?.category || "general";
      stats.categories[cat] = (stats.categories[cat] || 0) + 1;
      
      const src = e.source || "manual";
      stats.sources[src] = (stats.sources[src] || 0) + 1;
    });

    await TrainingDataset.update(
      { stats },
      { where: { id: datasetId } }
    );
  }

  /**
   * Exportar dataset para formato específico
   */
  async exportDataset(datasetId: number, format: DatasetFormat): Promise<any> {
    const { default: TrainingExample } = await import("../../models/TrainingExample");
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");

    const dataset = await TrainingDataset.findByPk(datasetId);
    if (!dataset) throw new Error("Dataset não encontrado");

    const examples = await TrainingExample.findAll({
      where: { datasetId },
      order: [["quality", "DESC"], ["createdAt", "DESC"]]
    });

    // Exportar conforme formato
    switch (format) {
      case "openai":
        return this.exportOpenAI(examples);
      case "anthropic":
        return this.exportAnthropic(examples);
      case "gemini":
        return this.exportGemini(examples);
      case "llama":
        return this.exportLlama(examples);
      default:
        return this.exportGeneric(examples);
    }
  }

  /**
   * Exportar no formato OpenAI (JSONL)
   */
  private exportOpenAI(examples: any[]): { format: string; data: string } {
    const lines = examples.map(ex => ({
      messages: ex.messages
    }));

    return {
      format: "openai-jsonl",
      data: lines.map(l => JSON.stringify(l)).join("\n")
    };
  }

  /**
   * Exportar no formato Anthropic
   */
  private exportAnthropic(examples: any[]): { format: string; data: any[] } {
    return {
      format: "anthropic",
      data: examples.map(ex => ({
        human: ex.messages.find((m: any) => m.role === "user")?.content || "",
        assistant: ex.messages.find((m: any) => m.role === "assistant")?.content || ""
      }))
    };
  }

  /**
   * Exportar no formato Gemini
   */
  private exportGemini(examples: any[]): { format: string; data: any[] } {
    return {
      format: "gemini",
      data: examples.map(ex => ({
        contents: ex.messages.map((m: any) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        }))
      }))
    };
  }

  /**
   * Exportar no formato Llama
   */
  private exportLlama(examples: any[]): { format: string; data: string } {
    const formatted = examples.map(ex => {
      const system = ex.messages.find((m: any) => m.role === "system")?.content || "";
      const user = ex.messages.find((m: any) => m.role === "user")?.content || "";
      const assistant = ex.messages.find((m: any) => m.role === "assistant")?.content || "";
      
      return `<s>[INST] ${system}\n\n${user} [/INST] ${assistant}</s>`;
    }).join("\n\n");

    return {
      format: "llama-instruct",
      data: formatted
    };
  }

  /**
   * Exportar genérico
   */
  private exportGeneric(examples: any[]): { format: string; data: any[] } {
    return {
      format: "generic",
      data: examples.map(ex => ({
        conversation: ex.messages,
        metadata: ex.metadata
      }))
    };
  }

  /**
   * Importar exemplos de conversas reais
   */
  async importFromConversations(
    datasetId: number,
    companyId: number,
    ticketIds: number[],
    options?: {
      minMessages?: number;
      maxMessages?: number;
      quality?: number;
    }
  ): Promise<{ imported: number; skipped: number }> {
    const { default: Ticket } = await import("../../models/Ticket");
    const { default: Message } = await import("../../models/Message");

    let imported = 0;
    let skipped = 0;

    for (const ticketId of ticketIds) {
      try {
        const messages = await Message.findAll({
          where: { ticketId },
          order: [["createdAt", "ASC"]]
        });

        if (messages.length < (options?.minMessages || 2)) {
          skipped++;
          continue;
        }

        // Agrupar mensagens em conversas
        const conversation: TrainingMessage[] = [];
        for (const msg of messages.slice(0, options?.maxMessages || 20)) {
          conversation.push({
            role: msg.fromMe ? "assistant" : "user",
            content: msg.body
          });
        }

        await this.addExample(
          datasetId,
          companyId,
          {
            messages: conversation,
            metadata: {
              category: "conversation",
              quality: options?.quality || 0.8,
              source: "conversation",
              ticketId
            }
          }
        );

        imported++;
      } catch (error) {
        logger.error(`[TrainingDataset] Erro ao importar ticket ${ticketId}:`, error);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  /**
   * Verificar exemplo (human-in-the-loop)
   */
  async verifyExample(
    exampleId: number,
    userId: number,
    updates?: { messages?: TrainingMessage[]; quality?: number }
  ): Promise<void> {
    const { default: TrainingExample } = await import("../../models/TrainingExample");

    const example = await TrainingExample.findByPk(exampleId);
    if (!example) throw new Error("Exemplo não encontrado");

    await example.update({
      isVerified: true,
      verifiedBy: userId,
      verifiedAt: new Date(),
      ...(updates?.messages && { messages: updates.messages }),
      ...(updates?.quality && { quality: updates.quality })
    });

    await this.updateDatasetStats(example.datasetId);

    logger.info(`[TrainingDataset] Exemplo verificado: ${exampleId} por ${userId}`);
  }

  /**
   * Fork dataset (criar nova versão)
   */
  async forkDataset(
    datasetId: number,
    newName: string,
    userId: number
  ): Promise<any> {
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");
    const { default: TrainingExample } = await import("../../models/TrainingExample");

    const original = await TrainingDataset.findByPk(datasetId);
    if (!original) throw new Error("Dataset não encontrado");

    // Criar novo dataset
    const forked = await TrainingDataset.create({
      companyId: original.companyId,
      agentId: original.agentId,
      name: newName,
      description: `${original.description || ""} (fork de v${original.version})`,
      version: "1.0.0",
      format: original.format,
      metadata: {
        ...original.metadata,
        forkedFrom: original.id,
        forkedAt: new Date().toISOString(),
        forkedBy: userId
      }
    });

    // Copiar exemplos
    const examples = await TrainingExample.findAll({
      where: { datasetId: original.id }
    });

    for (const ex of examples) {
      await TrainingExample.create({
        datasetId: forked.id,
        companyId: ex.companyId,
        messages: ex.messages,
        metadata: { ...ex.metadata, forkedFrom: ex.id },
        source: ex.source,
        quality: ex.quality,
        tokens: ex.tokens,
        isVerified: false // Requer re-verificação
      });
    }

    await this.updateDatasetStats(forked.id);

    logger.info(`[TrainingDataset] Fork criado: ${original.id} -> ${forked.id}`);
    return forked;
  }

  /**
   * Listar datasets
   */
  async listDatasets(companyId: number, agentId?: number): Promise<any[]> {
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");

    const where: any = { companyId };
    if (agentId) where.agentId = agentId;

    return await TrainingDataset.findAll({
      where,
      order: [["updatedAt", "DESC"]]
    });
  }

  /**
   * Obter detalhes do dataset
   */
  async getDataset(datasetId: number): Promise<any> {
    const { default: TrainingDataset } = await import("../../models/TrainingDataset");
    const { default: TrainingExample } = await import("../../models/TrainingExample");

    const dataset = await TrainingDataset.findByPk(datasetId);
    if (!dataset) throw new Error("Dataset não encontrado");

    const examples = await TrainingExample.findAll({
      where: { datasetId },
      limit: 10,
      order: [["quality", "DESC"]]
    });

    return {
      ...dataset.toJSON(),
      preview: examples
    };
  }
}

// Singleton
export const trainingDatasetService = new TrainingDatasetService();
export default trainingDatasetService;
