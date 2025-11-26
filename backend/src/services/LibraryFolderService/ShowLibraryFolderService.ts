import AppError from "../../errors/AppError";
import LibraryFolder from "../../models/LibraryFolder";
import Queue from "../../models/Queue";

interface Request {
    folderId: number;
    companyId: number;
}

const ShowLibraryFolderService = async ({
    folderId,
    companyId
}: Request): Promise<LibraryFolder> => {
    const folder = await LibraryFolder.findOne({
        where: { id: folderId, companyId },
        include: [
            {
                association: "parent",
                attributes: ["id", "name", "slug"]
            },
            {
                association: "children",
                separate: true
            },
            {
                association: "files",
                separate: true
            },
            {
                association: "queueSources",
                include: [
                    {
                        model: Queue,
                        as: "queue",
                        attributes: ["id", "name", "color"]
                    }
                ]
            }
        ]
    });

    if (!folder) {
        throw new AppError("ERR_LIBRARY_FOLDER_NOT_FOUND", 404);
    }

    return folder;
};

export default ShowLibraryFolderService;
