import AppError from "../../errors/AppError";
import QueueRAGSource from "../../models/QueueRAGSource";
import Queue from "../../models/Queue";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    queueId: number;
    folderId: number;
    weight?: number;
}

const LinkFolderToQueueService = async ({
    queueId,
    folderId,
    weight = 1.0
}: Request): Promise<QueueRAGSource> => {
    // Verificar se a fila existe
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    }

    // Verificar se a pasta existe
    const folder = await LibraryFolder.findByPk(folderId);
    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    // Verificar se já existe o vínculo
    const existing = await QueueRAGSource.findOne({
        where: { queueId, folderId }
    });

    if (existing) {
        throw new AppError("ERR_RAG_SOURCE_ALREADY_LINKED", 400);
    }

    // Criar o vínculo
    const ragSource = await QueueRAGSource.create({
        queueId,
        folderId,
        weight
    });

    return ragSource;
};

export default LinkFolderToQueueService;
