import LibraryFolder from "../../models/LibraryFolder";
import LibraryFile from "../../models/LibraryFile";
import ReindexLibraryFileService from "./ReindexLibraryFileService";
import AppError from "../../errors/AppError";

interface Request {
    folderId: number;
    recursive?: boolean;
}

interface ReindexFolderResult {
    total: number;
    reindexed: number;
    failed: number;
    results: {
        fileId: number;
        title: string;
        status: "success" | "failed";
        error?: string;
        chunks?: number;
    }[];
}

/**
 * Reindexar todos os arquivos de uma pasta (força reindexação mesmo que já estejam indexados)
 */
const ReindexFolderService = async ({
    folderId,
    recursive = false
}: Request): Promise<ReindexFolderResult> => {
    const folder = await LibraryFolder.findByPk(folderId);

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    console.log(`[LibraryRAG] Starting folder reindexation: ${folder.name} (recursive: ${recursive})`);

    const result: ReindexFolderResult = {
        total: 0,
        reindexed: 0,
        failed: 0,
        results: []
    };

    // Função auxiliar para reindexar arquivos de uma pasta
    const reindexFilesInFolder = async (currentFolderId: number) => {
        const files = await LibraryFile.findAll({
            where: { folderId: currentFolderId }
        });

        result.total += files.length;

        for (const file of files) {
            try {
                const indexResult = await ReindexLibraryFileService({ fileId: file.id });

                result.reindexed++;
                result.results.push({
                    fileId: file.id,
                    title: file.title,
                    status: "success",
                    chunks: indexResult.chunks
                });

            } catch (error: any) {
                console.error(`[LibraryRAG] Failed to reindex file ${file.title}:`, error.message);

                result.failed++;
                result.results.push({
                    fileId: file.id,
                    title: file.title,
                    status: "failed",
                    error: error.message
                });
            }
        }

        // Se recursivo, processar subpastas
        if (recursive) {
            const subFolders = await LibraryFolder.findAll({
                where: { parentId: currentFolderId }
            });

            for (const subFolder of subFolders) {
                console.log(`[LibraryRAG] Processing subfolder: ${subFolder.name}`);
                await reindexFilesInFolder(subFolder.id);
            }
        }
    };

    // Iniciar reindexação
    await reindexFilesInFolder(folderId);

    console.log(`[LibraryRAG] Folder reindexation complete: ${result.reindexed}/${result.total} reindexed, ${result.failed} failed`);

    return result;
};

export default ReindexFolderService;
