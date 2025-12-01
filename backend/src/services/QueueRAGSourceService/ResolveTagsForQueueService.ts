import QueueRAGSource from "../../models/QueueRAGSource";
import LibraryFolder from "../../models/LibraryFolder";
import Queue from "../../models/Queue";

interface Request {
    queueId: number;
}

/**
 * Resolve as tags de busca RAG para uma fila.
 * Retorna todas as tags das pastas vinculadas à fila.
 * 
 * Se a fila tem folderId === -1, busca em TODAS as pastas da empresa.
 */
const ResolveTagsForQueueService = async ({
    queueId
}: Request): Promise<string[]> => {
    const tags: string[] = [];

    // NOVO: Verificar se a fila tem folderId === -1 (Todas as Pastas)
    const queue = await Queue.findByPk(queueId);
    if (queue && (queue as any).folderId === -1) {
        // Buscar TODAS as pastas da empresa
        const allFolders = await LibraryFolder.findAll({
            where: { companyId: queue.companyId }
        });

        for (const folder of allFolders) {
            tags.push(`folder:${folder.id}`);
            if (folder.slug) {
                tags.push(`folderSlug:${folder.slug}`);
            }
        }

        console.log(`[RAG] Queue ${queueId} has folderId=-1, using ALL ${allFolders.length} folders`);
        return tags;
    }

    // Sistema normal: usar QueueRAGSources vinculadas
    const ragSources = await QueueRAGSource.findAll({
        where: { queueId, mode: "include" },
        include: [
            {
                model: LibraryFolder,
                as: "folder"
            }
        ]
    });

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
