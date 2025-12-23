import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import AppError from "../../errors/AppError";

interface Request {
    companyId: number;
    name: string;
    profile: "sales" | "support" | "service" | "hybrid";
    queueIds?: number[];
    voiceEnabled?: boolean;
    imageRecognitionEnabled?: boolean;
    sentimentAnalysisEnabled?: boolean;
    autoSegmentationEnabled?: boolean;
    status?: "active" | "inactive";
    // AI Model Override
    aiProvider?: "openai" | "gemini" | null;
    aiModel?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
    // Advanced Settings
    creativity?: string | null;
    toneStyle?: string | null;
    emojiUsage?: string | null;
    hashtagUsage?: string | null;
    responseLength?: string | null;
    language?: string | null;
    brandVoice?: string | null;
    allowedVariables?: string | null;
    // Voice/TTS Settings
    voiceType?: "text" | "generated" | "enabled" | null;
    voiceApiKey?: string | null;
    voiceRegion?: string | null;
    voiceTemperature?: number | null;
    voiceName?: string | null;
    // STT Settings
    sttProvider?: "openai" | "gemini" | "disabled" | null;
    // Inactivity Timeout
    inactivityTimeoutMinutes?: number | null;
    inactivityAction?: "close" | "transfer" | null;
    inactivityMessage?: string | null;
    // Business Hours
    businessHours?: any;
    outOfHoursMessage?: string | null;
    // Lead Qualification
    requireLeadQualification?: boolean;
    requiredLeadFields?: string[];
    leadFieldMapping?: any;
    qualifiedLeadTag?: string | null;
    leadQualificationMessage?: string | null;
    // Anti bot-bot / delay inicial
    startDelayEnabled?: boolean | null;
    startDelaySeconds?: number | null;
    startDelayJitterSeconds?: number | null;
    antiBotTraitsRegex?: string | null;
    maxBotLoopMessages?: number | null;
    requireHistoryForAI?: boolean | null;
    // Tag de lead quente
    sdrHotLeadTag?: string | null;
    funnelStages?: Array<{
        order: number;
        name: string;
        tone: string;
        objective?: string;
        systemPrompt: string;
        enabledFunctions?: string[];
        autoAdvanceCondition?: string;
        sentimentThreshold?: number;
    }>;
}

const CreateAIAgentService = async ({
    companyId,
    name,
    profile,
    queueIds = [],
    voiceEnabled = false,
    imageRecognitionEnabled = false,
    sentimentAnalysisEnabled = true,
    autoSegmentationEnabled = false,
    status,
    aiProvider,
    aiModel,
    temperature,
    maxTokens,
    creativity,
    toneStyle,
    emojiUsage,
    hashtagUsage,
    responseLength,
    language,
    brandVoice,
    allowedVariables,
    voiceType,
    voiceApiKey,
    voiceRegion,
    voiceTemperature,
    voiceName,
    sttProvider,
    inactivityTimeoutMinutes,
    inactivityAction,
    inactivityMessage,
    businessHours,
    outOfHoursMessage,
    requireLeadQualification,
    requiredLeadFields,
    leadFieldMapping,
    qualifiedLeadTag,
    leadQualificationMessage,
    // Anti bot-bot / delay inicial
    startDelayEnabled,
    startDelaySeconds,
    startDelayJitterSeconds,
    antiBotTraitsRegex,
    maxBotLoopMessages,
    requireHistoryForAI,
    // Tag de lead quente
    sdrHotLeadTag,
    funnelStages = []
}: Request): Promise<AIAgent> => {
    // Criar agente
    const agent = await AIAgent.create({
        companyId,
        name,
        profile,
        queueIds,
        voiceEnabled,
        imageRecognitionEnabled,
        sentimentAnalysisEnabled,
        autoSegmentationEnabled,
        status: status || "active",
        aiProvider: aiProvider as any,
        aiModel: aiModel as any,
        temperature: temperature as any,
        maxTokens: maxTokens as any,
        creativity: creativity as any,
        toneStyle: toneStyle as any,
        emojiUsage: emojiUsage as any,
        hashtagUsage: hashtagUsage as any,
        responseLength: responseLength as any,
        language: language as any,
        brandVoice: brandVoice as any,
        allowedVariables: allowedVariables as any,
        voiceType: voiceType as any,
        voiceApiKey: voiceApiKey as any,
        voiceRegion: voiceRegion as any,
        voiceTemperature: voiceTemperature as any,
        voiceName: voiceName as any,
        sttProvider: sttProvider as any,
        inactivityTimeoutMinutes: inactivityTimeoutMinutes as any,
        inactivityAction: inactivityAction as any,
        inactivityMessage: inactivityMessage as any,
        businessHours: businessHours as any,
        outOfHoursMessage: outOfHoursMessage as any,
        requireLeadQualification: requireLeadQualification as any,
        requiredLeadFields: requiredLeadFields as any,
        leadFieldMapping: leadFieldMapping as any,
        qualifiedLeadTag: qualifiedLeadTag as any,
        leadQualificationMessage: leadQualificationMessage as any,
        startDelayEnabled: startDelayEnabled as any,
        startDelaySeconds: startDelaySeconds as any,
        startDelayJitterSeconds: startDelayJitterSeconds as any,
        antiBotTraitsRegex: antiBotTraitsRegex as any,
        maxBotLoopMessages: maxBotLoopMessages as any,
        requireHistoryForAI: requireHistoryForAI as any,
        sdrHotLeadTag: sdrHotLeadTag as any
    });

    // Criar etapas do funil se fornecidas
    if (funnelStages.length > 0) {
        await Promise.all(
            funnelStages.map(stage =>
                FunnelStage.create({
                    agentId: agent.id,
                    ...stage
                })
            )
        );
    }

    // Recarregar com stages
    await agent.reload({ include: [FunnelStage] });

    return agent;
};

export default CreateAIAgentService;
