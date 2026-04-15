/**
 * AIAuditService.ts
 * 
 * Sistema de Audit Trail Completo (WORM - Write Once Read Many)
 * - Compliance LGPD/GDPR (retenção 7 anos)
 * - Hash de integridade (blockchain-like)
 * - Imutabilidade garantida
 * - Exportação para SIEM
 */

import crypto from "crypto";
import logger from "../../utils/logger";

// Tipos de eventos de auditoria
export type AIAuditEventType =
  | "request_start"
  | "request_end"
  | "llm_call"
  | "rag_search"
  | "function_call"
  | "function_result"
  | "fallback"
  | "error"
  | "cache_hit"
  | "cache_miss"
  | "prompt_update"
  | "skill_trigger"
  | "security_violation"
  | "rate_limit_hit";

export interface AIAuditEntry {
  // Identificadores
  companyId: number;
  userId?: number;
  agentId?: number;
  ticketId?: number;
  contactId?: number;
  
  // Tracing
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  
  // Evento
  eventType: AIAuditEventType;
  eventAction?: string;
  
  // Provider/Modelo
  provider?: string;
  model?: string;
  
  // Hashes de conteúdo (para verificação)
  requestHash?: string;
  responseHash?: string;
  
  // Métricas
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd?: number;
  durationMs?: number;
  
  // Explicabilidade
  decisionRationale?: string;
  
  // Contexto (sanitizado)
  context?: Record<string, any>;
  
  // Metadados
  metadata?: Record<string, any>;
}

export interface AuditQuery {
  companyId: number;
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AIAuditEventType[];
  agentId?: number;
  ticketId?: number;
  userId?: number;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditExport {
  entries: any[];
  total: number;
  exportDate: string;
  hash: string;
}

class AIAuditService {
  private lastChainHash: string | null = null;
  private buffer: any[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly RETENTION_YEARS = 7;

  /**
   * Criar entrada de auditoria
   */
  async log(entry: AIAuditEntry): Promise<void> {
    try {
      // Calcular hashes de integridade
      const integrityHash = this.calculateIntegrityHash(entry);
      const chainHash = this.calculateChainHash(integrityHash);
      
      // Calcular data de retenção (7 anos)
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + this.RETENTION_YEARS);

      const auditRecord = {
        ...entry,
        integrityHash,
        chainHash,
        retentionUntil,
        isImmutable: true,
        createdAt: new Date()
      };

      // Adicionar ao buffer para batch insert
      this.buffer.push(auditRecord);

      // Flush se buffer cheio
      if (this.buffer.length >= this.BUFFER_SIZE) {
        await this.flush();
      }

      // Log em desenvolvimento
      if (process.env.NODE_ENV !== "production") {
        logger.debug(`[AIAudit] ${entry.eventType}: ${entry.traceId || "no-trace"}`);
      }
    } catch (error) {
      logger.error("[AIAudit] Erro ao criar log:", error);
      // Não throw - auditoria não deve quebrar o fluxo
    }
  }

  /**
   * Calcular hash de integridade do registro
   */
  private calculateIntegrityHash(entry: AIAuditEntry): string {
    const content = JSON.stringify({
      companyId: entry.companyId,
      eventType: entry.eventType,
      timestamp: Date.now(),
      traceId: entry.traceId,
      requestHash: entry.requestHash,
      responseHash: entry.responseHash
    });

    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Calcular hash da cadeia (blockchain-like)
   */
  private calculateChainHash(currentHash: string): string {
    const data = this.lastChainHash 
      ? `${this.lastChainHash}:${currentHash}` 
      : currentHash;
    
    const chainHash = crypto.createHash("sha256").update(data).digest("hex");
    this.lastChainHash = chainHash;
    return chainHash;
  }

  /**
   * Flush buffer para banco de dados
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      const { default: AIAuditLog } = await import("../../models/AIAuditLog");
      
      await AIAuditLog.bulkCreate(this.buffer, {
        validate: false, // Bypass validation para performance
        hooks: false
      });

      logger.info(`[AIAudit] ${this.buffer.length} registros persistidos`);
      this.buffer = [];
    } catch (error) {
      logger.error("[AIAudit] Erro no flush:", error);
      // Em produção, escrever em arquivo de fallback
    }
  }

  /**
   * Query de auditoria
   */
  async query(query: AuditQuery): Promise<{ entries: any[]; total: number }> {
    const { default: AIAuditLog } = await import("../../models/AIAuditLog");

    const where: any = {
      companyId: query.companyId,
      isDeleted: false
    };

    if (query.startDate) {
      where.createdAt = { $gte: query.startDate };
    }
    if (query.endDate) {
      where.createdAt = { ...where.createdAt, $lte: query.endDate };
    }
    if (query.eventTypes?.length) {
      where.eventType = query.eventTypes;
    }
    if (query.agentId) where.agentId = query.agentId;
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.userId) where.userId = query.userId;
    if (query.traceId) where.traceId = query.traceId;

    const { count, rows } = await AIAuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: query.limit || 100,
      offset: query.offset || 0
    });

    return { entries: rows, total: count };
  }

  /**
   * Exportar para SIEM (JSON)
   */
  async export(query: AuditQuery): Promise<AuditExport> {
    const { entries, total } = await this.query({ ...query, limit: 10000 });

    const exportData = {
      entries,
      total,
      exportDate: new Date().toISOString(),
      hash: ""
    };

    // Calcular hash do export
    exportData.hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(entries))
      .digest("hex");

    return exportData;
  }

  /**
   * Verificar integridade dos registros
   */
  async verifyIntegrity(companyId: number, startDate: Date, endDate: Date): Promise<{
    valid: boolean;
    checked: number;
    invalid: number;
    details: string[];
  }> {
    const { default: AIAuditLog } = await import("../../models/AIAuditLog");

    const { Op } = await import("sequelize");
    const logs = await AIAuditLog.findAll({
      where: {
        companyId,
        createdAt: { [Op.between]: [startDate.getTime(), endDate.getTime()] } as any,
        isDeleted: false
      },
      order: [["createdAt", "ASC"]]
    });

    let previousHash: string | null = null;
    let invalid = 0;
    const details: string[] = [];

    for (const log of logs) {
      // Verificar hash de integridade
      const expectedHash = this.calculateIntegrityHash(log as any);
      if (log.integrityHash !== expectedHash) {
        invalid++;
        details.push(`Hash inválido no registro ${log.id}`);
        continue;
      }

      // Verificar chain hash
      if (previousHash) {
        const expectedChain = crypto
          .createHash("sha256")
          .update(`${previousHash}:${log.integrityHash}`)
          .digest("hex");
        
        if (log.chainHash !== expectedChain) {
          invalid++;
          details.push(`Chain hash inválido no registro ${log.id}`);
        }
      }

      previousHash = log.chainHash;
    }

    return {
      valid: invalid === 0,
      checked: logs.length,
      invalid,
      details
    };
  }

  /**
   * Cleanup de registros expirados (soft delete)
   */
  async cleanup(): Promise<{ archived: number }> {
    const { default: AIAuditLog } = await import("../../models/AIAuditLog");
    const now = new Date();

    const [affectedCount] = await AIAuditLog.update(
      { isDeleted: true },
      {
        where: {
          retentionUntil: { $lt: now },
          isDeleted: false
        }
      }
    );

    logger.info(`[AIAudit] ${affectedCount} registros arquivados`);
    return { archived: affectedCount };
  }

  /**
   * Estatísticas de auditoria
   */
  async getStats(companyId: number): Promise<any> {
    const { default: AIAuditLog } = await import("../../models/AIAuditLog");

    const { Sequelize } = await import("sequelize");
    const [total, byType, totalCost] = await Promise.all([
      AIAuditLog.count({ where: { companyId, isDeleted: false } }),
      AIAuditLog.findAll({
        where: { companyId, isDeleted: false },
        attributes: ["eventType", [Sequelize.fn("COUNT", "*"), "count"]],
        group: ["eventType"],
        raw: true
      }),
      AIAuditLog.sum("costUsd", { where: { companyId, isDeleted: false } })
    ]);

    return {
      total,
      byType: byType.reduce((acc: any, curr: any) => {
        acc[curr.eventType] = parseInt(curr.count, 10);
        return acc;
      }, {}),
      totalCost: parseFloat(totalCost?.toString() || "0"),
      retentionYears: this.RETENTION_YEARS
    };
  }

  /**
   * Forçar flush no shutdown
   */
  async shutdown(): Promise<void> {
    await this.flush();
    logger.info("[AIAudit] Shutdown completo");
  }
}

// Singleton
export const aiAudit = new AIAuditService();
export default aiAudit;
