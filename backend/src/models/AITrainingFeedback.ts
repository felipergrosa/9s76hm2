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

@Table({ tableName: "AITrainingFeedbacks" })
export default class AITrainingFeedback extends Model<AITrainingFeedback> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Index("ai_training_feedback_company_idx")
  @Column(DataType.INTEGER)
  companyId!: number;

  @Index("ai_training_feedback_user_idx")
  @Column(DataType.INTEGER)
  userId!: number;

  @Index("ai_training_feedback_agent_idx")
  @Column(DataType.INTEGER)
  agentId!: number;

  @Index("ai_training_feedback_stage_idx")
  @Column(DataType.INTEGER)
  stageId!: number;

  @Index("ai_training_feedback_session_idx")
  @Column(DataType.STRING)
  sandboxSessionId!: string;

  @Column(DataType.INTEGER)
  messageIndex!: number;

  @Column(DataType.TEXT)
  customerText?: string | null;

  @Column(DataType.TEXT)
  assistantText?: string | null;

  @Column(DataType.STRING)
  rating!: "correct" | "wrong";

  @Column(DataType.TEXT)
  correctedText?: string | null;

  @Column(DataType.TEXT)
  explanation?: string | null;

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt!: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt!: Date;
}
