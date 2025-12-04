import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import LibraryFolder from "../../models/LibraryFolder";
import FilesOptions from "../../models/FilesOptions";
import { LibraryFileStatus } from "../../models/LibraryFile";
import IndexLibraryFileService from "../RAG/IndexLibraryFileService";

interface Request {
    folderId: number;
    fileOptionId: number;
    title: string;
    tags?: string[];
    autoIndex?: boolean; // Se true, indexa automaticamente no RAG
}

const CreateLibraryFileService = async ({
    folderId,
    fileOptionId,
    title,
    tags = [],
    autoIndex = true
}: Request): Promise<LibraryFile> => {
    // Verificar se a pasta existe
    const folder = await LibraryFolder.findByPk(folderId);

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    // Verificar se o arquivo existe
    const fileOption = await FilesOptions.findByPk(fileOptionId);

    if (!fileOption) {
        throw new AppError("ERR_FILE_OPTION_NOT_FOUND", 404);
    }

    // Criar o LibraryFile
    const libraryFile = await LibraryFile.create({
        folderId,
        fileOptionId,
        title,
        tags,
        statusRag: LibraryFileStatus.PENDING
    });

    // Indexar automaticamente no RAG (em background)
    if (autoIndex) {
        // Não bloqueia a criação - indexa em background
        IndexLibraryFileService({ fileId: libraryFile.id })
            .then(result => {
                console.log(`[LibraryFile] Auto-indexed file ${libraryFile.id}: ${result.chunks} chunks`);
            })
            .catch(err => {
                console.error(`[LibraryFile] Failed to auto-index file ${libraryFile.id}:`, err.message);
            });
    }

    return libraryFile;
};

export default CreateLibraryFileService;
