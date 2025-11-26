import AppError from "../../errors/AppError";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    folderId: number;
    companyId: number;
    name?: string;
    description?: string;
    defaultTags?: string[];
    defaultLanguage?: string;
    ragPriority?: number;
    parentId?: number;
}

const UpdateLibraryFolderService = async ({
    folderId,
    companyId,
    name,
    description,
    defaultTags,
    defaultLanguage,
    ragPriority,
    parentId
}: Request): Promise<LibraryFolder> => {
    const folder = await LibraryFolder.findOne({
        where: { id: folderId, companyId }
    });

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    // Se mudar o nome, atualizar o slug
    let newSlug = folder.slug;
    if (name && name !== folder.name) {
        const slugPart = name.toLowerCase().replace(/\s+/g, "_");

        if (folder.parentId) {
            const parent = await LibraryFolder.findByPk(folder.parentId);
            if (parent && parent.slug) {
                newSlug = `${parent.slug}/${slugPart}`;
            } else {
                newSlug = slugPart;
            }
        } else {
            newSlug = slugPart;
        }

        // Atualizar slug dos filhos também
        const children = await LibraryFolder.findAll({
            where: { parentId: folderId }
        });

        for (const child of children) {
            const childSlugPart = child.name.toLowerCase().replace(/\s+/g, "_");
            await child.update({ slug: `${newSlug}/${childSlugPart}` });
        }
    }

    await folder.update({
        name: name !== undefined ? name : folder.name,
        description: description !== undefined ? description : folder.description,
        defaultTags: defaultTags !== undefined ? defaultTags : folder.defaultTags,
        defaultLanguage: defaultLanguage !== undefined ? defaultLanguage : folder.defaultLanguage,
        ragPriority: ragPriority !== undefined ? ragPriority : folder.ragPriority,
        slug: newSlug,
        parentId: parentId !== undefined ? parentId : folder.parentId
    });

    return folder;
};

export default UpdateLibraryFolderService;
