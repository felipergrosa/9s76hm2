import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import KnowledgeDocument from "../../models/KnowledgeDocument";
import KnowledgeChunk from "../../models/KnowledgeChunk";
import { LibraryFileStatus } from "../../models/LibraryFile";
import IndexLibraryFileService from "./IndexLibraryFileService";

interface Request {
    fileId: number;
}

interface ReindexResult {
    documentId: number;
    chunks: number;
}

/**
 * Reindexar um arquivo que já foi indexado anteriormente.
 * Deleta o documento RAG antigo e cria um novo.
 */
const ReindexLibraryFileService = async ({
    fileId
}: Request): Promise<ReindexResult> => {
    const file = await LibraryFile.findByPk(fileId, {
        include: ["knowledgeDocument"]
    });

    if (!file) {
        throw new AppError("ERR_LIBRARY_FILE_NOT_FOUND", 404);
    }

    // Se existe documento RAG antigo, deletar
    if (file.knowledgeDocumentId) {
        console.log(`[LibraryRAG] Deleting old document ${file.knowledgeDocumentId} for reindexing`);

        // Deletar chunks primeiro (pode ser necessário se não tiver cascade)
        await KnowledgeChunk.destroy({
            where: { documentId: file.knowledgeDocumentId }
        });

        // Deletar documento
        await KnowledgeDocument.destroy({
            where: { id: file.knowledgeDocumentId }
        });

        // Limpar referência
        await file.update({
            knowledgeDocumentId: null,
            statusRag: LibraryFileStatus.PENDING
        });
    }

    // Indexar novamente
    const result = await IndexLibraryFileService({ fileId });

    console.log(`[LibraryRAG] Reindexed file ${file.title}: ${result.chunks} chunks`);

    return result;
};

export default ReindexLibraryFileService;
