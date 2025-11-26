import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import ShowService from "./ShowService";
import fs from "fs";
import path from "path";
import uploadConfig from "../../config/upload";

interface FileOption {
  id?: number;
  name?: string;
  path?: string;
  mediaType?: string;
  [key: string]: any; // Permite campos adicionais
}

interface Request {
  name: string;
  companyId: number;
  message: string;
  options?: FileOption[];
}

const CreateService = async ({
  name,
  message,
  companyId,
  options
}: Request): Promise<Files> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(3)
    // Removida validação de nome único - permite criar Files com mesmo nome
    // Isso é intencional para permitir re-upload de arquivos deletados
  });

  try {
    await schema.validate({ name });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new AppError(err.message);
  }
  const safeMessage = message ?? "";
  let fileList = await Files.create({
    name,
    message: safeMessage,
    companyId
  });

  if (options && options.length > 0) {
    // Arquivos do POST foram salvos em public/files por padrão. Move cada um para a pasta definitiva
    const publicRoot = uploadConfig.directory; // mesmo diretório usado pelo express.static("/public")
    const tmpFolder = path.join(publicRoot, "files");
    const finalFolder = path.join(publicRoot, `company${companyId}`, "files", String(fileList.id));

    // CORREÇÃO: Garantir permissões corretas na pasta
    try {
      fs.mkdirSync(finalFolder, { recursive: true, mode: 0o755 });
    } catch (e) {
      console.error("Erro ao criar pasta:", e);
      throw new AppError("ERR_CREATE_FOLDER_FAILED");
    }

    const normalized = await Promise.all(
      options.map(async info => {
        // Se 'path' já for um caminho com subpastas (ex.: companyX/...), mantém
        if (info.path && info.path.includes("/")) {
          return { ...info };
        }

        const filename = info.path as string; // nome simples salvo pelo multer
        const src = path.join(tmpFolder, filename);
        const dest = path.join(finalFolder, filename);
        try {
          if (fs.existsSync(src)) {
            fs.renameSync(src, dest);
            // CORREÇÃO: Garantir permissões de leitura
            fs.chmodSync(dest, 0o644);
          }
        } catch (e) {
          console.error("Erro ao mover arquivo:", e);
          // Se não mover, ainda assim seguimos e gravamos o path relativo se o arquivo já estiver em dest
        }

        const relPath = path.posix.join(`company${companyId}`, "files", String(fileList.id), filename);
        return {
          ...info,
          path: relPath
        };
      })
    );

    await Promise.all(
      normalized.map(async info => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await FilesOptions.upsert({ ...info, fileId: fileList.id });
      })
    );
  }

  fileList = await ShowService(fileList.id, companyId)

  return fileList;
};

export default CreateService;