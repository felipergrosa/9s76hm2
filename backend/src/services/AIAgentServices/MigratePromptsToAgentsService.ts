import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import Prompt from "../../models/Prompt";
import { Op } from "sequelize";

interface Request {
    companyId: number;
    dryRun?: boolean;
}

interface MigrationResult {
    created: number;
    skipped: number;
    errors: string[];
    agents: {
        id: number;
        name: string;
        promptId: number;
        queueName: string;
    }[];
}

const MigratePromptsToAgentsService = async ({
    companyId,
    dryRun = false
}: Request): Promise<MigrationResult> => {
    const result: MigrationResult = {
        created: 0,
        skipped: 0,
        errors: [],
        agents: []
    };

    try {
        // Buscar todos os prompts da empresa
        const prompts = await Prompt.findAll({
            where: { companyId },
            include: [{
                association: "queue",
                required: false
            }]
        });

        console.log(`[Migration] Found ${prompts.length} prompts for company ${companyId}`);

        for (const prompt of prompts) {
            try {
                const queueId = prompt.queueId;
                const queueName = (prompt as any).queue?.name || "Sem Fila";

                // Verificar se já existe agente para esta fila
                if (queueId) {
                    const existingAgent = await AIAgent.findOne({
                        where: {
                            companyId,
                            queueIds: {
                                [Op.contains]: [queueId]
                            }
                        }
                    });

                    if (existingAgent) {
                        console.log(`[Migration] Skipping - Agent already exists for queue ${queueName}`);
                        result.skipped++;
                        continue;
                    }
                }

                // Verificar se já existe agente com nome similar
                const agentName = `${prompt.name || "Agente"} (Migrado)`;
                const duplicateByName = await AIAgent.findOne({
                    where: {
                        companyId,
                        name: agentName
                    }
                });

                if (duplicateByName) {
                    console.log(`[Migration] Skipping - Agent with name "${agentName}" already exists`);
                    result.skipped++;
                    continue;
                }

                if (dryRun) {
                    console.log(`[DRY RUN] Would create agent: ${agentName} for queue: ${queueName}`);
                    result.created++;
                    continue;
                }

                // Criar agente com base no prompt
                const agent = await AIAgent.create({
                    companyId,
                    name: agentName,
                    profile: "hybrid", // Default para híbrido
                    queueIds: queueId ? [queueId] : [],
                    voiceEnabled: false,
                    imageRecognitionEnabled: false,
                    sentimentAnalysisEnabled: true,
                    autoSegmentationEnabled: false,
                    status: "inactive" // Criar inativo para revisão manual
                });

                // Criar etapa única com o prompt legado
                await FunnelStage.create({
                    agentId: agent.id,
                    order: 1,
                    name: "Atendimento",
                    tone: "Profissional",
                    objective: `Atender clientes usando prompt: ${prompt.name}`,
                    systemPrompt: prompt.prompt || "Você é um assistente útil.",
                    enabledFunctions: [],
                    autoAdvanceCondition: null,
                    sentimentThreshold: null
                });

                result.created++;
                result.agents.push({
                    id: agent.id,
                    name: agent.name,
                    promptId: prompt.id,
                    queueName
                });

                console.log(`[Migration] ✅ Created agent "${agent.name}" for queue "${queueName}"`);
            } catch (err: any) {
                const errorMsg = `Prompt "${prompt.name}": ${err.message}`;
                result.errors.push(errorMsg);
                console.error(`[Migration] ❌ ${errorMsg}`);
            }
        }

        console.log(`[Migration] Summary - Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    } catch (error: any) {
        result.errors.push(`Global error: ${error.message}`);
        console.error(`[Migration] Fatal error:`, error);
    }

    return result;
};

export default MigratePromptsToAgentsService;
