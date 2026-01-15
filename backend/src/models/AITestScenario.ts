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

@Table({ tableName: "AITestScenarios" })
export default class AITestScenario extends Model<AITestScenario> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Index("ai_test_scenario_company_idx")
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  companyId!: number;

  @Index("ai_test_scenario_user_idx")
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @Index("ai_test_scenario_agent_idx")
  @ForeignKey(() => AIAgent)
  @Column(DataType.INTEGER)
  agentId!: number;

  @Index("ai_test_scenario_stage_idx")
  @ForeignKey(() => FunnelStage)
  @Column(DataType.INTEGER)
  stageId!: number;

  @Column(DataType.STRING(255))
  name!: string;

  @Column(DataType.TEXT)
  description!: string | null;

  @Column(DataType.TEXT)
  conversations!: string;

  @Column(DataType.STRING(50))
  status!: string;

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
