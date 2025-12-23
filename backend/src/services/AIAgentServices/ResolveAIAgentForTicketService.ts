import { Op } from "sequelize";
import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import Ticket from "../../models/Ticket";

interface AIAgentConfig {
    agent: AIAgent;
    currentStage: FunnelStage;
    systemPrompt: string;
    tone?: string;
    enabledFunctions: string[];
    voiceEnabled: boolean;
    imageRecognitionEnabled: boolean;
    sentimentAnalysisEnabled: boolean;
    autoSegmentationEnabled: boolean;
}

interface Request {
    ticket: Ticket;
    aiAgentId?: number;
}

const ResolveAIAgentForTicketService = async ({
    ticket,
    aiAgentId
}: Request): Promise<AIAgentConfig | null> => {
    try {
        let agent: AIAgent | null = null;

        // Se um agente específico foi solicitado, priorizar ele (desde que ativo e da empresa)
        if (aiAgentId) {
            agent = await AIAgent.findOne({
                where: {
                    id: aiAgentId,
                    companyId: ticket.companyId,
                    status: "active"
                },
                include: [
                    {
                        model: FunnelStage,
                        as: "funnelStages",
                        required: false
                    }
                ]
            });
        }

        // Caso não tenha sido solicitado ou não encontrado, buscar por fila
        if (!agent) {
            agent = await AIAgent.findOne({
                where: {
                    companyId: ticket.companyId,
                    status: "active",
                    // PostgreSQL: verificar se queueId está no array queueIds
                    queueIds: {
                        [Op.contains]: [ticket.queueId]
                    }
                },
                include: [
                    {
                        model: FunnelStage,
                        as: "funnelStages",
                        required: false
                    }
                ]
            });
        }

        if (!agent) {
            console.log(`[AI Agent] No active agent found for ticket ${ticket.id}, queue ${ticket.queueId}`);
            return null;
        }

        // Buscar etapas do funil ordenadas
        const stages = await FunnelStage.findAll({
            where: { agentId: agent.id },
            order: [["order", "ASC"]]
        });

        if (!stages || stages.length === 0) {
            console.warn(`[AI Agent] Agent ${agent.id} (${agent.name}) has no funnel stages`);
            return null;
        }

        // TODO: Implementar lógica de progressão de etapas baseada em histórico
        // Por enquanto, sempre usar a primeira etapa
        const currentStage = stages[0];

        console.log(`[AI Agent] Using agent "${agent.name}" (ID: ${agent.id}) for ticket ${ticket.id}`);
        console.log(`[AI Agent] Current stage: "${currentStage.name}" (Order: ${currentStage.order})`);

        return {
            agent,
            currentStage,
            systemPrompt: currentStage.systemPrompt,
            tone: currentStage.tone || undefined,
            enabledFunctions: currentStage.enabledFunctions || [],
            voiceEnabled: agent.voiceEnabled,
            imageRecognitionEnabled: agent.imageRecognitionEnabled,
            sentimentAnalysisEnabled: agent.sentimentAnalysisEnabled,
            autoSegmentationEnabled: agent.autoSegmentationEnabled
        };
    } catch (error) {
        console.error("[AI Agent] Error resolving AI agent for ticket:", error);
        return null;
    }
};

export default ResolveAIAgentForTicketService;
