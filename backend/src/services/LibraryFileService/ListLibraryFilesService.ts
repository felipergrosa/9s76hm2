import LibraryFile from "../../models/LibraryFile";
import FilesOptions from "../../models/FilesOptions";
import { LibraryFileStatus } from "../../models/LibraryFile";

interface Request {
    folderId: number;
    statusRag?: LibraryFileStatus;
}

const ListLibraryFilesService = async ({
    folderId,
    statusRag
}: Request): Promise<LibraryFile[]> => {
    const where: any = { folderId };

    if (statusRag) {
        where.statusRag = statusRag;
    }

    const files = await LibraryFile.findAll({
        where,
        include: [
            {
                association: "fileOption",
                include: [{
                    association: "file",
                    attributes: ["id", "companyId", "name"]
                }]
            },
            {
                association: "folder",
                attributes: ["id", "name", "slug"]
            },
            {
                association: "knowledgeDocument",
                attributes: ["id", "title", "createdAt"]
            }
        ],
        order: [["createdAt", "DESC"]]
    });

    return files;
};

export default ListLibraryFilesService;
