import fs from "fs";
import path from "path";
import LibraryFile from "../../models/LibraryFile";
import uploadConfig from "../../config/upload";

interface IncomingFile {
  index: number;
  name: string;
  size?: number;
}

interface Request {
  folderId: number;
  files: IncomingFile[];
}

interface DuplicateInfo {
  index: number;
  name: string;
  existing: {
    id: number;
    title: string;
    size?: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Verifica arquivos duplicados em uma pasta da Library
 * baseado em mesmo nome e (opcionalmente) mesmo tamanho.
 */
const CheckDuplicateFilesInFolderService = async ({
  folderId,
  files
}: Request): Promise<DuplicateInfo[]> => {
  if (!folderId || !files || files.length === 0) return [];

  const libraryFiles = await LibraryFile.findAll({
    where: { folderId },
    include: [
      {
        association: "folder",
        attributes: ["companyId"],
        required: false
      },
      {
        association: "fileOption",
        include: ["file"],
        required: true
      }
    ]
  });

  const publicRoot = uploadConfig.directory;
  const duplicates: DuplicateInfo[] = [];

  for (const incoming of files) {
    const candidates = libraryFiles.filter(f => f.title === incoming.name);
    if (!candidates.length) continue;

    for (const file of candidates) {
      try {
        const relPath = (file as any).fileOption?.path as string | undefined;
        if (!relPath) continue;

        const companyId =
          file.folder?.companyId ||
          ((file as any).fileOption?.file?.companyId as number | undefined);

        let filePath: string;
        if (path.isAbsolute(relPath)) {
          filePath = relPath;
        } else if (relPath.startsWith("company")) {
          filePath = path.resolve(publicRoot, relPath);
        } else {
          const baseFileId =
            (file as any).fileOption?.fileId ||
            (file as any).fileOption?.file?.id;

          filePath = path.resolve(
            publicRoot,
            `company${companyId}`,
            "files",
            String(baseFileId),
            relPath
          );
        }

        const stats = fs.statSync(filePath);

        // Se o tamanho foi enviado, só considera duplicado se bater
        if (
          typeof incoming.size === "number" &&
          incoming.size > 0 &&
          incoming.size !== stats.size
        ) {
          continue;
        }

        duplicates.push({
          index: incoming.index,
          name: incoming.name,
          existing: {
            id: file.id,
            title: file.title,
            size: stats.size,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt
          }
        });

        // Basta o primeiro match por arquivo de entrada
        break;
      } catch (err) {
        console.warn("[LibraryDuplicates] Falha ao ler arquivo físico:", err);
      }
    }
  }

  return duplicates;
};

export default CheckDuplicateFilesInFolderService;
