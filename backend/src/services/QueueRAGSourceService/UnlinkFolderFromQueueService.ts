import AppError from "../../errors/AppError";
import QueueRAGSource from "../../models/QueueRAGSource";
import Queue from "../../models/Queue";

interface Request {
    queueId: number;
    folderId: number;
    companyId: number;
}

const UnlinkFolderFromQueueService = async ({
    queueId,
    folderId,
    companyId
}: Request): Promise<void> => {
    // Fila precisa pertencer ao tenant
    const queue = await Queue.findOne({ where: { id: queueId, companyId } });
    if (!queue) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    }

    const ragSource = await QueueRAGSource.findOne({
        where: { queueId, folderId }
    });

    if (!ragSource) {
        throw new AppError("ERR_RAG_SOURCE_NOT_FOUND", 404);
    }

    await ragSource.destroy();
};

export default UnlinkFolderFromQueueService;
