import LibraryFolder from "../../models/LibraryFolder";
import Queue from "../../models/Queue";

interface Request {
    companyId: number;
    parentId?: number;
}

const ListLibraryFoldersService = async ({
    companyId,
    parentId
}: Request): Promise<LibraryFolder[]> => {
    const folders = await LibraryFolder.findAll({
        where: {
            companyId,
            parentId: parentId || null
        },
        include: [
            {
                association: "children",
                separate: true
            },
            {
                association: "files",
                separate: true,
                attributes: ["id", "title", "statusRag"]
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
        ],
        order: [["name", "ASC"]]
    });

    return folders;
};

export default ListLibraryFoldersService;
