import AppError from "../../errors/AppError";
import QueueRAGSource from "../../models/QueueRAGSource";

interface Request {
    queueId: number;
    folderId: number;
}

const UnlinkFolderFromQueueService = async ({
    queueId,
    folderId
}: Request): Promise<void> => {
    const ragSource = await QueueRAGSource.findOne({
        where: { queueId, folderId }
    });

    if (!ragSource) {
        throw new AppError("ERR_RAG_SOURCE_NOT_FOUND", 404);
    }

    await ragSource.destroy();
};

export default UnlinkFolderFromQueueService;
