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
        status: status || agent.status
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
