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
import AITestScenario from "./AITestScenario";

@Table({ tableName: "AITestResults" })
export default class AITestResult extends Model<AITestResult> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Index("ai_test_result_company_idx")
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  companyId!: number;

  @Index("ai_test_result_user_idx")
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @Index("ai_test_result_scenario_idx")
  @ForeignKey(() => AITestScenario)
  @Column(DataType.INTEGER)
  scenarioId!: number;

  @Index("ai_test_result_agent_idx")
  @ForeignKey(() => AIAgent)
  @Column(DataType.INTEGER)
  agentId!: number;

  @Index("ai_test_result_stage_idx")
  @ForeignKey(() => FunnelStage)
  @Column(DataType.INTEGER)
  stageId!: number;

  @Column(DataType.TEXT)
  promptUsed!: string;

  @Column(DataType.TEXT)
  results!: string;

  @Column(DataType.INTEGER)
  overallScore!: number;

  @Column(DataType.INTEGER)
  passRate!: number;

  @Column(DataType.INTEGER)
  totalTests!: number;

  @Column(DataType.INTEGER)
  passedTests!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Company)
  company!: Company;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => AITestScenario)
  scenario!: AITestScenario;

  @BelongsTo(() => AIAgent)
  agent!: AIAgent;

  @BelongsTo(() => FunnelStage)
  stage!: FunnelStage;
}
