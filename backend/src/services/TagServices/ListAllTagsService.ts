import LibraryFile from "../../models/LibraryFile";
import LibraryFolder from "../../models/LibraryFolder";
import { Op } from "sequelize";

interface Request {
    companyId: number;
    search?: string;
    limit?: number;
}

interface TagInfo {
    tag: string;
    count: number;
    source: "file" | "folder" | "both";
}

/**
 * Lista todas as tags únicas usadas em arquivos e pastas da empresa
 * Retorna com contagem de uso e sugestões baseadas em busca
 */
const ListAllTagsService = async ({
    companyId,
    search,
    limit = 50
}: Request): Promise<TagInfo[]> => {
    const tagMap = new Map<string, { count: number; sources: Set<string> }>();

    // 1. Buscar tags de LibraryFiles
    const folders = await LibraryFolder.findAll({
        where: { companyId },
        attributes: ["id"]
    });

    const folderIds = folders.map(f => f.id);

    if (folderIds.length > 0) {
        const files = await LibraryFile.findAll({
            where: {
                folderId: { [Op.in]: folderIds }
            },
            attributes: ["tags"]
        });

        for (const file of files) {
            const tags = file.tags || [];
            for (const tag of tags) {
                const normalizedTag = tag.toLowerCase().trim();
                if (!normalizedTag) continue;
                
                const existing = tagMap.get(normalizedTag);
                if (existing) {
                    existing.count++;
                    existing.sources.add("file");
                } else {
                    tagMap.set(normalizedTag, { count: 1, sources: new Set(["file"]) });
                }
            }
        }
    }

    // 2. Buscar tags de LibraryFolders
    const foldersWithTags = await LibraryFolder.findAll({
        where: { companyId },
        attributes: ["defaultTags"]
    });

    for (const folder of foldersWithTags) {
        const tags = folder.defaultTags || [];
        for (const tag of tags) {
            const normalizedTag = tag.toLowerCase().trim();
            if (!normalizedTag) continue;
            
            const existing = tagMap.get(normalizedTag);
            if (existing) {
                existing.count++;
                existing.sources.add("folder");
            } else {
                tagMap.set(normalizedTag, { count: 1, sources: new Set(["folder"]) });
            }
        }
    }

    // 3. Converter para array e ordenar
    let results: TagInfo[] = Array.from(tagMap.entries()).map(([tag, info]) => ({
        tag,
        count: info.count,
        source: info.sources.size > 1 ? "both" : (info.sources.has("file") ? "file" : "folder")
    }));

    // 4. Filtrar por busca se fornecida
    if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        results = results.filter(t => t.tag.includes(searchLower));
    }

    // 5. Ordenar por contagem (mais usadas primeiro) e depois alfabeticamente
    results.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
    });

    // 6. Limitar resultados
    return results.slice(0, limit);
};

export default ListAllTagsService;
