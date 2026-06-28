import { Op } from "sequelize";
import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import Ticket from "../../models/Ticket";
import TicketFunnelState from "../../models/TicketFunnelState";
import AdvanceFunnelStageService from "./AdvanceFunnelStageService";

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
    /**
     * Mensagem recebida do cliente nesta rodada. Quando informada, o serviço
     * avalia (uma única vez) se a etapa atual do funil deve avançar antes de
     * retornar a configuração — item 12 do plano. Quando omitida, o serviço
     * só LÊ a etapa atual, sem avaliar avanço (uso em chamadas read-only,
     * como o filtro de funções e o merge de settings, que já resolvem o
     * agente mais de uma vez por mensagem).
     */
    messageText?: string;
}

const ResolveAIAgentForTicketService = async ({
    ticket,
    aiAgentId,
    messageText
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

        // Item 12 do plano: etapa atual é a mais recente registrada em
        // TicketFunnelState para este ticket+agente. Se ainda não houver
        // registro (primeiro contato deste ticket com este agente), usa a
        // primeira etapa (por order) e grava a entrada inicial no histórico.
        let currentStage: FunnelStage;

        const latestState = await TicketFunnelState.findOne({
            where: { ticketId: ticket.id, agentId: agent.id },
            order: [["createdAt", "DESC"]]
        });

        if (latestState) {
            currentStage = stages.find(s => s.id === latestState.funnelStageId) || stages[0];
        } else {
            currentStage = stages[0];
            try {
                await TicketFunnelState.create({
                    ticketId: ticket.id,
                    funnelStageId: currentStage.id,
                    agentId: agent.id,
                    companyId: ticket.companyId,
                    enteredAt: new Date()
                } as any);
            } catch (error) {
                console.error("[AI Agent] Erro ao registrar entrada inicial no funil:", error);
            }
        }

        // Avalia avanço de etapa baseado na mensagem atual (só quando
        // messageText é informado — ver comentário na interface Request).
        if (messageText) {
            currentStage = await AdvanceFunnelStageService({
                ticket,
                agent,
                currentStage,
                stages,
                messageText
            });
        }

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
