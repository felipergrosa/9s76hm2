import AppError from "../../errors/AppError";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    companyId: number;
    name: string;
    parentId?: number;
    description?: string;
    defaultTags?: string[];
    defaultLanguage?: string;
    ragPriority?: number;
}

const CreateLibraryFolderService = async ({
    companyId,
    name,
    parentId,
    description,
    defaultTags = [],
    defaultLanguage = "pt-BR",
    ragPriority = 5
}: Request): Promise<LibraryFolder> => {
    // Se tem parentId, verificar se a pasta pai existe
    if (parentId) {
        const parentFolder = await LibraryFolder.findOne({
            where: { id: parentId, companyId }
        });

        if (!parentFolder) {
            throw new AppError("ERR_PARENT_FOLDER_NOT_FOUND", 404);
        }
    }

    // Gerar slug baseado na hierarquia
    let slug = name.toLowerCase().replace(/\s+/g, "_");

    if (parentId) {
        const parent = await LibraryFolder.findByPk(parentId);
        if (parent && parent.slug) {
            slug = `${parent.slug}/${slug}`;
        }
    }

    const folder = await LibraryFolder.create({
        companyId,
        name,
        parentId,
        description,
        slug,
        defaultTags,
        defaultLanguage,
        ragPriority
    });

    return folder;
};

export default CreateLibraryFolderService;
