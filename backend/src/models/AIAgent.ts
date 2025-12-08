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

    // ========== HORÁRIO DE FUNCIONAMENTO ==========
    // Horário de funcionamento em formato JSON
    // Ex: {"seg": {"start": "08:00", "end": "18:00"}, "ter": {...}, ...}
    @Column({ type: DataType.JSON, defaultValue: {} })
    businessHours: object;

    // Mensagem fora do horário de funcionamento
    @Column(DataType.TEXT)
    outOfHoursMessage: string;

    // ========== QUALIFICAÇÃO DE LEAD ==========
    // Exigir cadastro completo antes de enviar materiais (tabelas, catálogos)
    @Column({ type: DataType.BOOLEAN, defaultValue: false })
    requireLeadQualification: boolean;

    // Campos obrigatórios para qualificação (JSON array)
    // Ex: ["cnpj", "email", "razaoSocial"]
    @Column({ type: DataType.JSON, defaultValue: ["cnpj", "email"] })
    requiredLeadFields: string[];

    // Mapeamento de campos do agente para campos do contato (JSON)
    // Ex: {"cnpj": "cnpj", "razaoSocial": "name", "email": "email", "nomeFantasia": "fantasyName"}
    @Column({ 
        type: DataType.JSON, 
        defaultValue: {
            "cnpj": "cnpj",
            "razaoSocial": "name",
            "email": "email",
            "nomeFantasia": "fantasyName",
            "cidade": "city",
            "segmento": "segment"
        }
    })
    leadFieldMapping: object;

    // Tag a ser adicionada quando lead for qualificado
    @Column({ type: DataType.STRING, defaultValue: "lead_qualificado" })
    qualifiedLeadTag: string;

    // Mensagem solicitando dados do lead
    @Column({ type: DataType.TEXT, defaultValue: "Para enviar nossa tabela de preços, preciso de algumas informações. Qual o CNPJ da sua empresa?" })
    leadQualificationMessage: string;

    // ========== SDR (Sales Development Representative) ==========
    
    // Habilitar modo SDR
    @Column({ type: DataType.BOOLEAN, defaultValue: false })
    sdrEnabled: boolean;

    // Perfil do Cliente Ideal (ICP) - JSON
    // Ex: { segments: ["loja iluminação", "arquiteto"], sizes: ["medio", "grande"], regions: ["SP", "RJ"], criteria: "..." }
    @Column({ 
        type: DataType.JSON, 
        defaultValue: {
            segments: [],
            sizes: [],
            regions: [],
            criteria: ""
        }
    })
    sdrICP: object;

    // Metodologia de qualificação: BANT, SPIN, GPCT, custom
    @Column({ type: DataType.STRING, defaultValue: "BANT" })
    sdrMethodology: string;

    // Perguntas de qualificação - JSON array
    // Ex: [{ question: "Qual volume mensal?", type: "budget", points: 10 }, ...]
    @Column({ 
        type: DataType.JSON, 
        defaultValue: [
            { question: "Qual o volume de compras mensal da sua empresa?", type: "budget", points: 15 },
            { question: "Quem é responsável pelas decisões de compra?", type: "authority", points: 15 },
            { question: "Qual problema você está buscando resolver?", type: "need", points: 20 },
            { question: "Para quando você precisa dessa solução?", type: "timeline", points: 15 }
        ]
    })
    sdrQualificationQuestions: object;

    // Regras de scoring - JSON
    // Ex: { icpMatch: 20, hasCnpj: 15, askedPrice: 25, mentionedUrgency: 20, ... }
    @Column({ 
        type: DataType.JSON, 
        defaultValue: {
            icpMatch: 20,
            hasCnpj: 15,
            hasEmail: 10,
            askedPrice: 25,
            mentionedUrgency: 20,
            requestedHuman: 30,
            answeredQuestion: 10
        }
    })
    sdrScoringRules: object;

    // Score mínimo para transferir para closer
    @Column({ type: DataType.INTEGER, defaultValue: 70 })
    sdrMinScoreToTransfer: number;

    // Gatilhos automáticos de transferência - JSON array
    // Ex: ["pediu_orcamento", "prazo_urgente", "score_minimo"]
    @Column({ 
        type: DataType.JSON, 
        defaultValue: ["pediu_orcamento", "score_minimo"]
    })
    sdrTransferTriggers: object;

    // Habilitar agendamento de reuniões
    @Column({ type: DataType.BOOLEAN, defaultValue: false })
    sdrSchedulingEnabled: boolean;

    // Link do calendário (Calendly, Google Calendar, etc.)
    @Column(DataType.STRING)
    sdrCalendarLink: string;

    // Mensagem de convite para reunião
    @Column({ type: DataType.TEXT, defaultValue: "Que tal agendarmos uma conversa com nosso especialista? Ele pode te ajudar a encontrar a melhor solução para sua necessidade." })
    sdrSchedulingMessage: string;

    // Mensagem de handoff para closer
    @Column({ type: DataType.TEXT, defaultValue: "Vou transferir você para um de nossos especialistas que poderá te ajudar com mais detalhes. Um momento!" })
    sdrHandoffMessage: string;

    // Tag adicionada quando lead atinge score mínimo
    @Column({ type: DataType.STRING, defaultValue: "lead_quente" })
    sdrHotLeadTag: string;

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
