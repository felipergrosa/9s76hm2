import LibraryFolder from "../../models/LibraryFolder";
import LibraryFile, { LibraryFileStatus } from "../../models/LibraryFile";
import IndexFolderService, { IndexFolderResult } from "./IndexFolderService";
import IndexLibraryFileService from "./IndexLibraryFileService";

interface Request {
  companyId: number;
}

interface IndexAllResult extends IndexFolderResult {
  foldersProcessed: number;
}

const IndexAllLibraryFilesService = async ({ companyId }: Request): Promise<IndexAllResult> => {
  const result: IndexAllResult = {
    total: 0,
    indexed: 0,
    failed: 0,
    skipped: 0,
    results: [],
    foldersProcessed: 0
  };

  const rootFolders = await LibraryFolder.findAll({
    where: { companyId, parentId: null }
  });

  for (const folder of rootFolders) {
    const folderResult = await IndexFolderService({ folderId: folder.id, recursive: true });

    result.total += folderResult.total;
    result.indexed += folderResult.indexed;
    result.failed += folderResult.failed;
    result.skipped += folderResult.skipped;
    result.results.push(...folderResult.results);
    result.foldersProcessed += 1;
  }

  const orphanFiles = await LibraryFile.findAll({
    where: { folderId: null },
    include: [
      {
        association: "fileOption",
        include: [
          {
            association: "file",
            attributes: ["id", "companyId"],
            where: { companyId }
          }
        ]
      }
    ]
  });

  for (const file of orphanFiles) {
    const exists = result.results.find(r => r.fileId === file.id);
    if (exists) {
      continue;
    }

    result.total += 1;

    if (file.statusRag === LibraryFileStatus.INDEXED) {
      result.skipped += 1;
      result.results.push({
        fileId: file.id,
        title: file.title,
        status: "skipped"
      });
      continue;
    }

    try {
      const fileResult = await IndexLibraryFileService({ fileId: file.id });
      result.indexed += 1;
      result.results.push({
        fileId: file.id,
        title: file.title,
        status: "success",
        chunks: fileResult.chunks
      });
    } catch (error: any) {
      result.failed += 1;
      result.results.push({
        fileId: file.id,
        title: file.title,
        status: "failed",
        error: error.message
      });
    }
  }

  return result;
};

export default IndexAllLibraryFilesService;
