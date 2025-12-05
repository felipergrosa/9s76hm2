import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import AppError from "../../errors/AppError";

interface Request {
    id: number;
    companyId: number;
    name?: string;
    profile?: "sales" | "support" | "service" | "hybrid";
    queueIds?: number[];
    voiceEnabled?: boolean;
    imageRecognitionEnabled?: boolean;
    sentimentAnalysisEnabled?: boolean;
    autoSegmentationEnabled?: boolean;
    status?: "active" | "inactive";
    // AI Model Override
    aiProvider?: "openai" | "gemini";
    aiModel?: string;
    temperature?: number;
    maxTokens?: number;
    // Advanced Settings
    creativity?: string;
    toneStyle?: string;
    emojiUsage?: string;
    hashtagUsage?: string;
    responseLength?: string;
    language?: string;
    brandVoice?: string;
    allowedVariables?: string;
    // Voice/TTS Settings
    voiceType?: "text" | "generated" | "enabled";
    voiceApiKey?: string;
    voiceRegion?: string;
    voiceTemperature?: number;
    voiceName?: string;
    // STT Settings
    sttProvider?: "openai" | "gemini" | "disabled";
    funnelStages?: Array<{
        id?: number;
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

const UpdateAIAgentService = async ({
    id,
    companyId,
    name,
    profile,
    queueIds,
    voiceEnabled,
    imageRecognitionEnabled,
    sentimentAnalysisEnabled,
    autoSegmentationEnabled,
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
    funnelStages
}: Request): Promise<AIAgent> => {
    const agent = await AIAgent.findOne({
        where: { id, companyId }
    });

    if (!agent) {
        throw new AppError("ERR_AGENT_NOT_FOUND", 404);
    }

    // Atualizar agente
    await agent.update({
        name: name || agent.name,
        profile: profile || agent.profile,
        queueIds: queueIds !== undefined ? queueIds : agent.queueIds,
        voiceEnabled: voiceEnabled !== undefined ? voiceEnabled : agent.voiceEnabled,
        imageRecognitionEnabled:
            imageRecognitionEnabled !== undefined
                ? imageRecognitionEnabled
                : agent.imageRecognitionEnabled,
        sentimentAnalysisEnabled:
            sentimentAnalysisEnabled !== undefined
                ? sentimentAnalysisEnabled
                : agent.sentimentAnalysisEnabled,
        autoSegmentationEnabled:
            autoSegmentationEnabled !== undefined
                ? autoSegmentationEnabled
                : agent.autoSegmentationEnabled,
        status: status || agent.status,
        // AI Model Override
        aiProvider: aiProvider !== undefined ? aiProvider : agent.aiProvider,
        aiModel: aiModel !== undefined ? aiModel : agent.aiModel,
        temperature: temperature !== undefined ? temperature : agent.temperature,
        maxTokens: maxTokens !== undefined ? maxTokens : agent.maxTokens,
        // Advanced Settings
        creativity: creativity !== undefined ? creativity : agent.creativity,
        toneStyle: toneStyle !== undefined ? toneStyle : agent.toneStyle,
        emojiUsage: emojiUsage !== undefined ? emojiUsage : agent.emojiUsage,
        hashtagUsage: hashtagUsage !== undefined ? hashtagUsage : agent.hashtagUsage,
        responseLength: responseLength !== undefined ? responseLength : agent.responseLength,
        language: language !== undefined ? language : agent.language,
        brandVoice: brandVoice !== undefined ? brandVoice : agent.brandVoice,
        allowedVariables: allowedVariables !== undefined ? allowedVariables : agent.allowedVariables,
        // Voice/TTS Settings
        voiceType: voiceType !== undefined ? voiceType : agent.voiceType,
        voiceApiKey: voiceApiKey !== undefined ? voiceApiKey : agent.voiceApiKey,
        voiceRegion: voiceRegion !== undefined ? voiceRegion : agent.voiceRegion,
        voiceTemperature: voiceTemperature !== undefined ? voiceTemperature : agent.voiceTemperature,
        voiceName: voiceName !== undefined ? voiceName : agent.voiceName,
        // STT Settings
        sttProvider: sttProvider !== undefined ? sttProvider : agent.sttProvider
    });

    // Atualizar funnel stages se fornecidas
    if (funnelStages) {
        // Deletar stages antigas
        await FunnelStage.destroy({ where: { agentId: agent.id } });

        // Criar novas stages
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

export default UpdateAIAgentService;
