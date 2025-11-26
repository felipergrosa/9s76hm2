import QueueRAGSource from "../../models/QueueRAGSource";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    queueId: number;
}

/**
 * Resolve as tags de busca RAG para uma fila.
 * Retorna todas as tags das pastas vinculadas à fila.
 */
const ResolveTagsForQueueService = async ({
    queueId
}: Request): Promise<string[]> => {
    const ragSources = await QueueRAGSource.findAll({
        where: { queueId, mode: "include" },
        include: [
            {
                model: LibraryFolder,
                as: "folder"
            }
        ]
    });

    const tags: string[] = [];

    for (const source of ragSources) {
        if (source.folder) {
            // Adicionar tag de pasta
            tags.push(`folder:${source.folderId}`);

            // Adicionar tag de slug
            if (source.folder.slug) {
                tags.push(`folderSlug:${source.folder.slug}`);
            }
        }
    }

    // Adicionar tag de fila
    if (ragSources.length > 0) {
        tags.push(`queueId:${queueId}`);
    }

    return tags;
};

export default ResolveTagsForQueueService;
