import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  Index
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "AITrainingImprovements" })
export default class AITrainingImprovement extends Model<AITrainingImprovement> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Index("ai_training_improvement_company_idx")
  @Column(DataType.INTEGER)
  companyId!: number;

  @Index("ai_training_improvement_user_idx")
  @Column(DataType.INTEGER)
  userId!: number;

  @Index("ai_training_improvement_agent_idx")
  @Column(DataType.INTEGER)
  agentId!: number;

  @Index("ai_training_improvement_stage_idx")
  @Column(DataType.INTEGER)
  stageId!: number;

  @Column(DataType.INTEGER)
  feedbackId?: number | null;

  @Column(DataType.TEXT)
  improvementText!: string;

  // Categorização estruturada
  @Column(DataType.STRING(50))
  category!: "tone" | "accuracy" | "empathy" | "sales" | "routing" | "knowledge" | "formatting" | "other" | null;

  @Column(DataType.STRING(50))
  severity!: "low" | "medium" | "high" | null;

  @Column(DataType.STRING(100))
  intentDetected!: string | null;

  // Métricas de impacto
  @Column(DataType.BOOLEAN)
  verifiedInProduction!: boolean;

  @Column(DataType.INTEGER)
  improvementScore!: number | null;

  @Column(DataType.ENUM("pending", "applied", "rejected", "testing"))
  status!: "pending" | "applied" | "rejected" | "testing";

  @Column(DataType.DATE(6))
  appliedAt?: Date | null;

  @Column(DataType.TEXT)
  consolidatedPrompt?: string | null;

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt!: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt!: Date;
}
