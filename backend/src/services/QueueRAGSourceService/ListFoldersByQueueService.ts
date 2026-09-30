import AppError from "../../errors/AppError";
import QueueRAGSource from "../../models/QueueRAGSource";
import LibraryFolder from "../../models/LibraryFolder";
import Queue from "../../models/Queue";

interface Request {
    queueId: number;
    companyId: number;
}

const ListFoldersByQueueService = async ({
    queueId,
    companyId
}: Request): Promise<LibraryFolder[]> => {
    // Fila precisa pertencer ao tenant
    const queue = await Queue.findOne({ where: { id: queueId, companyId } });
    if (!queue) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    }

    const ragSources = await QueueRAGSource.findAll({
        where: { queueId },
        include: [
            {
                model: LibraryFolder,
                as: "folder",
                include: ["files"]
            }
        ]
    });

    return ragSources.map(rs => rs.folder).filter(Boolean) as LibraryFolder[];
};

export default ListFoldersByQueueService;
