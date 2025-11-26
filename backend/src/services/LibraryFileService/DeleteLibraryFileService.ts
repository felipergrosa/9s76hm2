import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import KnowledgeDocument from "../../models/KnowledgeDocument";

interface Request {
    fileId: number;
}

const DeleteLibraryFileService = async ({
    fileId
}: Request): Promise<void> => {
    const file = await LibraryFile.findByPk(fileId, {
        include: ["knowledgeDocument"]
    });

    if (!file) {
        throw new AppError("ERR_LIBRARY_FILE_NOT_FOUND", 404);
    }

    // Se tem documento RAG indexado, deletar também
    if (file.knowledgeDocumentId) {
        await KnowledgeDocument.destroy({
            where: { id: file.knowledgeDocumentId }
        });
        // Os chunks serão deletados em cascade
    }

    await file.destroy();
};

export default DeleteLibraryFileService;
