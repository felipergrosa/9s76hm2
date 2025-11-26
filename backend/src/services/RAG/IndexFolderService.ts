import LibraryFolder from "../../models/LibraryFolder";
import LibraryFile from "../../models/LibraryFile";
import { LibraryFileStatus } from "../../models/LibraryFile";
import IndexLibraryFileService from "./IndexLibraryFileService";
import AppError from "../../errors/AppError";

interface Request {
    folderId: number;
    recursive?: boolean;
}

export interface IndexFolderResult {
    total: number;
    indexed: number;
    failed: number;
    skipped: number;
    results: {
        fileId: number;
        title: string;
        status: "success" | "failed" | "skipped";
        error?: string;
        chunks?: number;
    }[];
}

/**
 * Indexa todos os arquivos de uma pasta (e opcionalmente de subpastas)
 */
const IndexFolderService = async ({
    folderId,
    recursive = false
}: Request): Promise<IndexFolderResult> => {
    const folder = await LibraryFolder.findByPk(folderId);

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    console.log(`[LibraryRAG] Starting folder indexation: ${folder.name} (recursive: ${recursive})`);

    const result: IndexFolderResult = {
        total: 0,
        indexed: 0,
        failed: 0,
        skipped: 0,
        results: []
    };

    // Função auxiliar para indexar arquivos de uma pasta
    const indexFilesInFolder = async (currentFolderId: number) => {
        const files = await LibraryFile.findAll({
            where: { folderId: currentFolderId }
        });

        result.total += files.length;

        for (const file of files) {
            // Pular arquivos já indexados (a menos que seja reindexação forçada)
            if (file.statusRag === LibraryFileStatus.INDEXED) {
                console.log(`[LibraryRAG] Skipping already indexed file: ${file.title}`);
                result.skipped++;
                result.results.push({
                    fileId: file.id,
                    title: file.title,
                    status: "skipped"
                });
                continue;
            }

            try {
                const indexResult = await IndexLibraryFileService({ fileId: file.id });

                result.indexed++;
                result.results.push({
                    fileId: file.id,
                    title: file.title,
                    status: "success",
                    chunks: indexResult.chunks
                });

            } catch (error: any) {
                console.error(`[LibraryRAG] Failed to index file ${file.title}:`, error.message);

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
                await indexFilesInFolder(subFolder.id);
            }
        }
    };

    // Iniciar indexação
    await indexFilesInFolder(folderId);

    console.log(`[LibraryRAG] Folder indexation complete: ${result.indexed}/${result.total} indexed, ${result.failed} failed, ${result.skipped} skipped`);

    return result;
};

export default IndexFolderService;
