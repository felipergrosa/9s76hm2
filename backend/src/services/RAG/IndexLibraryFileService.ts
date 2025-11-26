import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import { LibraryFileStatus } from "../../models/LibraryFile";
import FilesOptions from "../../models/FilesOptions";
import ResolveFinalTagsService from "../LibraryFileService/ResolveFinalTagsService";
import { indexFileAuto, IndexResult } from "./RAGIndexService";
import path from "path";
import uploadConfig from "../../config/upload";

interface Request {
    fileId: number;
}

/**
 * Indexa um arquivo da biblioteca no RAG
 */
const IndexLibraryFileService = async ({
    fileId
}: Request): Promise<IndexResult> => {
    const file = await LibraryFile.findByPk(fileId, {
        include: [
            {
                association: "folder",
                attributes: ["id", "companyId"]
            },
            {
                association: "fileOption",
                include: ["file"]
            }
        ]
    });

    if (!file) {
        throw new AppError("ERR_LIBRARY_FILE_NOT_FOUND", 404);
    }

    if (!file.fileOption || !file.fileOption.file) {
        throw new AppError("ERR_FILE_OPTION_NOT_FOUND", 404);
    }

    // Marcar como indexando
    await file.update({ statusRag: LibraryFileStatus.INDEXING });

    try {
        // Resolver tags finais (pasta + arquivo + técnicas + filas)
        const tags = await ResolveFinalTagsService({ fileId });

        // Obter caminho absoluto do arquivo a partir da pasta /public
        const relPath = (file.fileOption as any).path as string;
        if (!relPath) {
            throw new AppError("ERR_FILE_PATH_NOT_FOUND", 500);
        }

        const companyId = file.folder?.companyId || file.fileOption.file.companyId;
        const publicRoot = uploadConfig.directory;

        let filePath: string;
        if (path.isAbsolute(relPath)) {
            filePath = relPath;
        } else if (relPath.startsWith("company")) {
            filePath = path.resolve(publicRoot, relPath);
        } else {
            const baseFileId = (file.fileOption as any).fileId || (file.fileOption as any).file?.id;
            filePath = path.resolve(
                publicRoot,
                `company${companyId}`,
                "files",
                String(baseFileId),
                relPath
            );
        }

        console.log(`[LibraryRAG] Indexing file ${file.title} with ${tags.length} tags`);

        // Indexar usando o serviço existente
        const result = await indexFileAuto({
            companyId,
            title: file.title,
            filePath,
            tags,
            source: `library:${fileId}`,
            chunkSize: 1000,
            overlap: 200
        });

        // Marcar como indexado e vincular ao documento
        await file.update({
            statusRag: LibraryFileStatus.INDEXED,
            lastIndexedAt: new Date(),
            knowledgeDocumentId: result.documentId,
            errorMessage: null
        });

        console.log(`[LibraryRAG] Successfully indexed file ${file.title}: ${result.chunks} chunks`);

        return result;

    } catch (error: any) {
        console.error(`[LibraryRAG] Failed to index file ${file.title}:`, error.message);

        // Marcar como falho
        await file.update({
            statusRag: LibraryFileStatus.FAILED,
            errorMessage: error.message || "Erro desconhecido ao indexar arquivo"
        });

        throw new AppError(error.message || "Erro ao indexar arquivo", 500);
    }
};

export default IndexLibraryFileService;
