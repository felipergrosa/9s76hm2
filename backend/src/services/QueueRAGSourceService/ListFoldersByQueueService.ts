import QueueRAGSource from "../../models/QueueRAGSource";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    queueId: number;
}

const ListFoldersByQueueService = async ({
    queueId
}: Request): Promise<LibraryFolder[]> => {
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
