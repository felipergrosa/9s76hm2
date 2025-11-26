import AppError from "../../errors/AppError";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    folderId: number;
}

const DeleteLibraryFolderService = async ({
    folderId
}: Request): Promise<void> => {
    const folder = await LibraryFolder.findByPk(folderId, {
        include: [
            { association: "children" },
            { association: "files" }
        ]
    });

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    // Verificar se tem subpastas
    if (folder.children && folder.children.length > 0) {
        throw new AppError("ERR_LIBRARY_FOLDER_HAS_CHILDREN", 400);
    }

    // Verificar se tem arquivos
    if (folder.files && folder.files.length > 0) {
        throw new AppError("ERR_LIBRARY_FOLDER_HAS_FILES", 400);
    }

    await folder.destroy();
};

export default DeleteLibraryFolderService;
