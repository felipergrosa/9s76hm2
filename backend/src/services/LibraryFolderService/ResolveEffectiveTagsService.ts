import AppError from "../../errors/AppError";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
    folderId: number;
}

/**
 * Resolve as tags efetivas de uma pasta, incluindo herança de pastas ancestrais
 */
const ResolveEffectiveTagsService = async ({
    folderId
}: Request): Promise<string[]> => {
    const folder = await LibraryFolder.findByPk(folderId, {
        include: [{ association: "parent" }]
    });

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    let tags: string[] = [...(folder.defaultTags || [])];

    // Buscar tags dos ancestrais (percorrer hierarquia para cima)
    let currentParentId = folder.parentId;
    while (currentParentId) {
        const parentFolder = await LibraryFolder.findByPk(currentParentId);
        if (parentFolder && parentFolder.defaultTags) {
            // Adicionar tags únicas do pai
            for (const tag of parentFolder.defaultTags) {
                if (!tags.includes(tag)) {
                    tags.push(tag);
                }
            }
            currentParentId = parentFolder.parentId;
        } else {
            break;
        }
    }

    // Adicionar tags técnicas
    tags.push(`folder:${folderId}`);
    if (folder.slug) {
        tags.push(`folderSlug:${folder.slug}`);
    }

    return tags;
};

export default ResolveEffectiveTagsService;
