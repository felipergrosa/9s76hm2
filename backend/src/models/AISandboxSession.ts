import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import AIAgent from "./AIAgent";
import FunnelStage from "./FunnelStage";
import Whatsapp from "./Whatsapp";

// Role das mensagens do sandbox: "customer" = mensagem simulada do cliente,
// "assistant" = resposta gerada pela IA.
export type SandboxRole = "customer" | "assistant";

export interface AISandboxMessage {
  role: SandboxRole;
  text: string;
  timestamp: string;
}

/**
 * Sessão de sandbox de treinamento de IA persistida em banco.
 * Substitui o antigo Map em memória — sessões sobrevivem a restart
 * e expiram em 24h (campo expiresAt, checado na leitura).
 */
@Table({ tableName: "AISandboxSessions" })
class AISandboxSession extends Model<AISandboxSession> {
  // uuid hex gerado pela aplicação (crypto.randomBytes(16).toString("hex"))
  @PrimaryKey
  @Column(DataType.STRING)
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  userId: number;

  @ForeignKey(() => AIAgent)
  @Column
  agentId: number;

  @ForeignKey(() => FunnelStage)
  @Column
  stageId: number;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @Column(DataType.STRING)
  groupId: string;

  @Column(DataType.STRING)
  toNumber: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  simulate: boolean;

  @Column(DataType.TEXT)
  promptOverride: string;

  @Column({ type: DataType.JSONB, defaultValue: [] })
  messages: AISandboxMessage[];

  @Column(DataType.DATE(6))
  expiresAt: Date;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => AIAgent)
  agent: AIAgent;

  @BelongsTo(() => FunnelStage)
  stage: FunnelStage;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AISandboxSession;
