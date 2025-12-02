import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";

interface Request {
    companyId: number;
}

interface Response {
    agents: AIAgent[];
    count: number;
}

const ListAIAgentsService = async ({
    companyId
}: Request): Promise<Response> => {
    const agents = await AIAgent.findAll({
        where: { companyId },
        include: [
            {
                model: FunnelStage,
                as: "funnelStages",
                separate: true,
                order: [["order", "ASC"]]
            }
        ],
        order: [["createdAt", "DESC"]]
    });

    return {
        agents,
        count: agents.length
    };
};

export default ListAIAgentsService;
