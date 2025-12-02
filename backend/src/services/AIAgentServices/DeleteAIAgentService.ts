import AIAgent from "../../models/AIAgent";
import AppError from "../../errors/AppError";

interface Request {
    id: number;
    companyId: number;
}

const DeleteAIAgentService = async ({
    id,
    companyId
}: Request): Promise<void> => {
    const agent = await AIAgent.findOne({
        where: { id, companyId }
    });

    if (!agent) {
        throw new AppError("ERR_AGENT_NOT_FOUND", 404);
    }

    await agent.destroy();
};

export default DeleteAIAgentService;
