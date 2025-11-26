import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import { LibraryFileStatus } from "../../models/LibraryFile";

interface Request {
    fileId: number;
    title?: string;
    tags?: string[];
    folderId?: number;
    fileOptionId?: number;
}

const UpdateLibraryFileService = async ({
    fileId,
    title,
    tags,
    folderId,
    fileOptionId
}: Request): Promise<LibraryFile> => {
    const file = await LibraryFile.findByPk(fileId);

    if (!file) {
        throw new AppError("ERR_LIBRARY_FILE_NOT_FOUND", 404);
    }

    // Se mudar metadados, pasta ou arquivo físico, marcar como pendente para reindexação
    const needsReindex = !!(title || tags || folderId || fileOptionId);

    await file.update({
        title: title !== undefined ? title : file.title,
        tags: tags !== undefined ? tags : file.tags,
        folderId: folderId !== undefined ? folderId : file.folderId,
        fileOptionId: fileOptionId !== undefined ? fileOptionId : file.fileOptionId,
        ...(needsReindex && { statusRag: LibraryFileStatus.PENDING })
    });

    return file;
};

export default UpdateLibraryFileService;
