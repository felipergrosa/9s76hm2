import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo
} from "sequelize-typescript";
import AIAgent from "./AIAgent";

@Table({ tableName: "FunnelStages" })
class FunnelStage extends Model<FunnelStage> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => AIAgent)
    @Column
    agentId: number;

    @Column
    order: number;

    @Column
    name: string;

    @Column
    tone: string;

    @Column(DataType.TEXT)
    objective: string;

    @Column(DataType.TEXT)
    systemPrompt: string;

    @Column(DataType.JSON)
    enabledFunctions: string[];

    @Column({ type: DataType.TEXT, allowNull: true })
    autoAdvanceCondition: string;

    @Column({ type: DataType.FLOAT, allowNull: true })
    sentimentThreshold: number;

    @BelongsTo(() => AIAgent)
    agent: AIAgent;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default FunnelStage;
