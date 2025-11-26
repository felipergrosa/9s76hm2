import LibraryFile from "../../models/LibraryFile";
import LibraryFolder from "../../models/LibraryFolder";

interface Request {
  companyId: number;
}

interface LibraryTagDTO {
  id: string;
  name: string;
}

/**
 * Lista tags usadas na Library (arquivos + pastas) para uma empresa,
 * independentes das tags globais de contatos.
 */
const ListLibraryTagsService = async ({ companyId }: Request): Promise<LibraryTagDTO[]> => {
  const tagSet = new Set<string>();

  // Tags padrão de pastas
  const folders = await LibraryFolder.findAll({ where: { companyId } });
  for (const folder of folders) {
    const tags = folder.defaultTags || [];
    tags.forEach(t => {
      const name = String(t).trim();
      if (name) tagSet.add(name);
    });
  }

  // Tags dos arquivos da biblioteca (filtrando por companyId via pasta ou arquivo físico)
  const files = await LibraryFile.findAll({
    include: [
      {
        association: "folder",
        attributes: ["companyId"],
        required: false
      },
      {
        association: "fileOption",
        include: ["file"],
        required: false
      }
    ]
  });

  for (const file of files) {
    const folderCompanyId = file.folder?.companyId;
    const optionCompanyId = (file as any).fileOption?.file?.companyId as number | undefined;
    const effectiveCompanyId = folderCompanyId || optionCompanyId;

    if (effectiveCompanyId !== companyId) continue;

    const tags = file.tags || [];
    tags.forEach(t => {
      const name = String(t).trim();
      if (name) tagSet.add(name);
    });
  }

  return Array.from(tagSet).map(name => ({ id: name, name }));
};

export default ListLibraryTagsService;
