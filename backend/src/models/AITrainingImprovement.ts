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

  @Column(DataType.ENUM("pending", "applied"))
  status!: "pending" | "applied";

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
