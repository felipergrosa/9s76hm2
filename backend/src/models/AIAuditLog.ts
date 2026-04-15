import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table({ 
  tableName: "AIAuditLogs",
  timestamps: true,
  updatedAt: false,
  createdAt: "createdAt"
})
class AIAuditLog extends Model<AIAuditLog> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  userId: number;

  @Column
  agentId: number;

  @Column
  ticketId: number;

  @Column
  contactId: number;

  @Column(DataType.STRING(64))
  traceId: string;

  @Column(DataType.STRING(64))
  spanId: string;

  @Column(DataType.STRING(64))
  parentSpanId: string;

  @Column(DataType.ENUM(
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
  ))
  eventType: string;

  @Column(DataType.STRING(50))
  eventAction: string;

  @Column(DataType.STRING(50))
  provider: string;

  @Column(DataType.STRING(100))
  model: string;

  @Column(DataType.STRING(64))
  requestHash: string;

  @Column(DataType.STRING(64))
  responseHash: string;

  @Column(DataType.JSONB)
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };

  @Column(DataType.DECIMAL(10, 6))
  costUsd: number;

  @Column
  durationMs: number;

  @Column(DataType.TEXT)
  decisionRationale: string;

  @Column(DataType.JSONB)
  context: Record<string, any>;

  @Column(DataType.JSONB)
  metadata: Record<string, any>;

  @Column(DataType.STRING(64))
  integrityHash: string;

  @Column(DataType.STRING(64))
  chainHash: string;

  @Column(DataType.DATE)
  retentionUntil: Date;

  @Column({ defaultValue: true })
  isImmutable: boolean;

  @Column({ defaultValue: false })
  isDeleted: boolean;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.DATE)
  createdAt: Date;
}

export default AIAuditLog;
