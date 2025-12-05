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
    BelongsTo,
    HasMany
} from "sequelize-typescript";
import Company from "./Company";
import FunnelStage from "./FunnelStage";

@Table({ tableName: "AIAgents" })
class AIAgent extends Model<AIAgent> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Company)
    @Column
    companyId: number;

    @Column
    name: string;

    @Column(DataType.ENUM("sales", "support", "service", "hybrid"))
    profile: "sales" | "support" | "service" | "hybrid";

    @Column(DataType.JSON)
    queueIds: number[];

    @Column({ defaultValue: false })
    voiceEnabled: boolean;

    @Column({ defaultValue: false })
    imageRecognitionEnabled: boolean;

    @Column({ defaultValue: true })
    sentimentAnalysisEnabled: boolean;

    @Column({ defaultValue: false })
    autoSegmentationEnabled: boolean;

    @Column(DataType.ENUM("active", "inactive"))
    status: "active" | "inactive";

    // AI Model Override (null = usa global)
    @Column(DataType.ENUM("openai", "gemini"))
    aiProvider: "openai" | "gemini";

    @Column
    aiModel: string;

    @Column(DataType.FLOAT)
    temperature: number;

    @Column(DataType.INTEGER)
    maxTokens: number;

    // Advanced Settings (from legacy Prompts)
    @Column({ defaultValue: "medium" })
    creativity: string;

    @Column({ defaultValue: "professional" })
    toneStyle: string;

    @Column({ defaultValue: "medium" })
    emojiUsage: string;

    @Column({ defaultValue: "none" })
    hashtagUsage: string;

    @Column({ defaultValue: "medium" })
    responseLength: string;

    @Column({ defaultValue: "pt-BR" })
    language: string;

    @Column(DataType.TEXT)
    brandVoice: string;

    @Column(DataType.TEXT)
    allowedVariables: string;

    // Voice/TTS Settings
    @Column(DataType.ENUM("text", "generated", "enabled"))
    voiceType: "text" | "generated" | "enabled";

    @Column
    voiceApiKey: string;

    @Column
    voiceRegion: string;

    @Column({ type: DataType.FLOAT, defaultValue: 0.7 })
    voiceTemperature: number;

    @Column
    voiceName: string;

    // STT (Speech-to-Text) Settings
    @Column(DataType.ENUM("openai", "gemini", "disabled"))
    sttProvider: "openai" | "gemini" | "disabled";

    // Inactivity Timeout - tempo em minutos para finalizar conversa inativa
    // null ou 0 = desabilitado
    @Column({ type: DataType.INTEGER, defaultValue: 0 })
    inactivityTimeoutMinutes: number;

    // Ação ao timeout: "close" = fecha ticket, "transfer" = transfere para fila
    @Column(DataType.ENUM("close", "transfer"))
    inactivityAction: "close" | "transfer";

    // Mensagem enviada antes de fechar/transferir por inatividade
    @Column(DataType.TEXT)
    inactivityMessage: string;

    @BelongsTo(() => Company)
    company: Company;

    @HasMany(() => FunnelStage)
    funnelStages: FunnelStage[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default AIAgent;
