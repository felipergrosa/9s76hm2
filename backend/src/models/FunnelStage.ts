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

// item 12 do plano: transição tipada de etapa do funil. v1 só suporta
// "keyword" (match simples na mensagem do usuário) — sentimento/intenção
// ficam para uma evolução futura, já que não há infra de scoring hoje.
export interface IFunnelTransition {
    type: "keyword";
    value: string;
    targetStageKey: string;
}

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

    @Column({ type: DataType.STRING, allowNull: true })
    stageKey: string; // item 12 do plano: identificador estável da etapa, usado como alvo de transitions

    @Column({ type: DataType.JSON, defaultValue: [] })
    transitions: IFunnelTransition[]; // item 12 do plano: regras tipadas de avanço de etapa

    @BelongsTo(() => AIAgent)
    agent: AIAgent;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default FunnelStage;
