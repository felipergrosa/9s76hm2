import AppError from "../../errors/AppError";
import LibraryFile from "../../models/LibraryFile";
import ResolveEffectiveTagsService from "../LibraryFolderService/ResolveEffectiveTagsService";

interface Request {
    fileId: number;
}

/**
 * Resolve todas as tags finais de um arquivo:
 * - Tags da pasta (herdadas da hierarquia)
 * - Tags do arquivo
 * - Tags técnicas (tipo de arquivo, ano, etc.)
 * - Tags de filas vinculadas
 */
const ResolveFinalTagsService = async ({
    fileId
}: Request): Promise<string[]> => {
    const file = await LibraryFile.findByPk(fileId, {
        include: [
            {
                association: "folder",
                include: ["queueSources"]
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

    // 1. Tags da pasta (com herança), se houver pasta associada
    const folderTags = file.folderId
        ? await ResolveEffectiveTagsService({ folderId: file.folderId })
        : [];

    // 2. Tags do arquivo
    const fileTags = file.tags || [];

    // 3. Tags técnicas
    const technicalTags: string[] = [];

    // Tipo de arquivo (baseado no mediaType ou extensão)
    if (file.fileOption && file.fileOption.mediaType) {
        const mediaType = file.fileOption.mediaType.toLowerCase();
        if (mediaType.includes("pdf")) {
            technicalTags.push("type:pdf");
        } else if (mediaType.includes("image")) {
            technicalTags.push("type:image");
        } else if (mediaType.includes("video")) {
            technicalTags.push("type:video");
        } else if (mediaType.includes("audio")) {
            technicalTags.push("type:audio");
        }
    }

    // Ano (tentar extrair do título ou do nome do arquivo)
    const yearMatch = file.title.match(/20\d{2}/);
    if (yearMatch) {
        technicalTags.push(`year:${yearMatch[0]}`);
    }

    // ID do arquivo físico
    technicalTags.push(`file:${file.fileOptionId}`);

    // 4. Tags de filas vinculadas à pasta
    const queueTags: string[] = [];
    if (file.folder && file.folder.queueSources) {
        for (const queueSource of file.folder.queueSources) {
            queueTags.push(`queueId:${queueSource.queueId}`);
        }
    }

    // Combinar todas as tags (removendo duplicatas)
    const allTags = [
        ...folderTags,
        ...fileTags,
        ...technicalTags,
        ...queueTags
    ];

    // Remover duplicatas
    return Array.from(new Set(allTags));
};

export default ResolveFinalTagsService;
