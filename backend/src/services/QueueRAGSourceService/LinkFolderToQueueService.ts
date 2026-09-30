import AppError from "../../errors/AppError";
import QueueRAGSource from "../../models/QueueRAGSource";
import Queue from "../../models/Queue";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    queueId: number;
    folderId: number;
    weight?: number;
    companyId: number;
}

const LinkFolderToQueueService = async ({
    queueId,
    folderId,
    weight = 1.0,
    companyId
}: Request): Promise<QueueRAGSource> => {
    // Verificar se a fila existe e pertence ao tenant
    const queue = await Queue.findOne({ where: { id: queueId, companyId } });
    if (!queue) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    }

    // Verificar se a pasta existe e pertence ao tenant
    const folder = await LibraryFolder.findOne({ where: { id: folderId, companyId } });
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
