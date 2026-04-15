import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AIAuditLogs", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      // Identificadores
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Trace IDs
      traceId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      spanId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      parentSpanId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      // Evento
      eventType: {
        type: DataTypes.ENUM(
          "request_start",
          "request_end",
          "llm_call",
          "rag_search",
          "function_call",
          "function_result",
          "fallback",
          "error",
          "cache_hit",
          "cache_miss",
          "prompt_update",
          "skill_trigger",
          "security_violation",
          "rate_limit_hit"
        ),
        allowNull: false
      },
      eventAction: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      // Provider e Modelo
      provider: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      model: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      // Dados da requisição/resposta (hash)
      requestHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: "SHA256 do request"
      },
      responseHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: "SHA256 do response"
      },
      // Tokens e custo
      tokens: {
        type: DataTypes.JSONB,
        defaultValue: { prompt: 0, completion: 0, total: 0 }
      },
      costUsd: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0
      },
      // Latência
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Decision rationale (para explicabilidade)
      decisionRationale: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Explicação da decisão tomada pela IA"
      },
      // Contexto
      context: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: "Snapshot do contexto (sanitizado)"
      },
      // Metadados
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      // Dados para WORM (imutabilidade)
      integrityHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: "Hash de integridade para verificação WORM"
      },
      chainHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: "Hash do registro anterior (blockchain-like)"
      },
      // Retenção
      retentionUntil: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: () => new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 anos
        comment: "Data de expiração (LGPD/GDPR: 7 anos)"
      },
      // WORM flags
      isImmutable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: "Soft delete para compliance (dados mantidos)"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Índices essenciais
    await queryInterface.addIndex("AIAuditLogs", ["companyId", "createdAt"]);
    await queryInterface.addIndex("AIAuditLogs", ["companyId", "eventType"]);
    await queryInterface.addIndex("AIAuditLogs", ["traceId"]);
    await queryInterface.addIndex("AIAuditLogs", ["ticketId"]);
    await queryInterface.addIndex("AIAuditLogs", ["agentId"]);
    await queryInterface.addIndex("AIAuditLogs", ["userId"]);
    await queryInterface.addIndex("AIAuditLogs", ["retentionUntil"]);
    
    // Índice composto para queries de auditoria
    await queryInterface.addIndex("AIAuditLogs", ["companyId", "eventType", "createdAt"], {
      name: "idx_audit_company_event_time"
    });

    // Índice para compliance (range queries)
    await queryInterface.addIndex("AIAuditLogs", ["createdAt", "retentionUntil"], {
      name: "idx_audit_retention"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AIAuditLogs");
  }
};
