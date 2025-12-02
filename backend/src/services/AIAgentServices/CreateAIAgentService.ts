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
        status: "active"
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
