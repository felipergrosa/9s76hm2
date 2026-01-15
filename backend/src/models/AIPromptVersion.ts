import {
  Table,
  Column,
  DataType,
  Model,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  Index,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import AIAgent from "./AIAgent";
import FunnelStage from "./FunnelStage";

@Table({ tableName: "AIPromptVersions" })
export default class AIPromptVersion extends Model<AIPromptVersion> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Index("ai_prompt_version_company_idx")
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  companyId!: number;

  @Index("ai_prompt_version_user_idx")
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @Index("ai_prompt_version_agent_idx")
  @ForeignKey(() => AIAgent)
  @Column(DataType.INTEGER)
  agentId!: number;

  @Index("ai_prompt_version_stage_idx")
  @ForeignKey(() => FunnelStage)
  @Column(DataType.INTEGER)
  stageId!: number;

  @Column(DataType.INTEGER)
  version!: number;

  @Column(DataType.TEXT)
  systemPrompt!: string;

  @Column(DataType.STRING(500))
  changeDescription!: string | null;

  @Column(DataType.STRING(50))
  changeType!: string;

  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  @Column(DataType.INTEGER)
  testScore!: number | null;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Company)
  company!: Company;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => AIAgent)
  agent!: AIAgent;

  @BelongsTo(() => FunnelStage)
  stage!: FunnelStage;
}
