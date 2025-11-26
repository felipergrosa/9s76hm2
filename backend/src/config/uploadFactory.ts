import path from "path";
import fs from "fs";
import multer, { Options } from "multer";

export type Privacy = "public" | "private";

export interface CreateUploadOptions {
  privacy: Privacy;
  subfolder?: string; // ex.: "flowbuilder", "files"
  dynamic?: boolean; // se true, cria subpastas dinâmicas
  paramId?: string; // nome do parâmetro de rota a ser usado na pasta (ex: "fileListId")
  limits?: Options["limits"]; // sobrescrever limites padrão
  allowedMimes?: string[]; // sobrescrever whitelist padrão
}

const publicFolder = path.resolve(__dirname, "..", "..", "public");
const privateFolder = path.resolve(__dirname, "..", "..", "private");

export const DEFAULT_ALLOWED_MIMES: string[] = [
  // Imagens
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documentos
  "application/pdf",
  "text/plain",
  // Planilhas e dados tabulares
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  // Áudio
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/3gpp",
  "audio/3gpp2",
  "audio/amr",
  // Vídeo comum
  "video/mp4",
  "video/3gpp",
  "video/webm",
  "video/quicktime"
];

const DEFAULT_LIMITS: Options["limits"] = {
  fileSize: 50 * 1024 * 1024, // 50MB
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeFileName(originalname: string): string {
  const base = originalname.replace(/[\/\s]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  return base || `${Date.now()}`;
}

export function createUpload(opts: CreateUploadOptions) {
  const baseDir = opts.privacy === "private" ? privateFolder : publicFolder;

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        let finalDestination = baseDir;

        if (opts.subfolder) {
          finalDestination = path.join(finalDestination, opts.subfolder);
        }

        // Estrutura de pasta dinâmica: public/company<id>/<subfolder>/<paramId>
        if (opts.dynamic && req.user?.companyId && opts.paramId && req.params[opts.paramId]) {
          finalDestination = path.join(
            publicFolder, // Apenas para public
            `company${req.user.companyId}`,
            opts.subfolder || "",
            req.params[opts.paramId]
          );
        }

        ensureDir(finalDestination);
        cb(null, finalDestination);
      } catch (err) {
        cb(err as Error, "");
      }
    },
    filename: (_req, file, cb) => {
      const extFromOriginal = path.extname(file.originalname);
      const baseName = safeFileName(path.basename(file.originalname, extFromOriginal));
      const extFromMime = file.mimetype ? `.${file.mimetype.split("/")[1] || "bin"}` : "";

      // Compatível com uploadExt.ts: prioriza timestamp e extensão original quando existir
      const timestamp = Date.now();
      const ext = extFromOriginal || extFromMime || "";
      const finalName = `${timestamp}_${baseName}${ext}`;
      cb(null, finalName);
    }
  });

  const allowedMimes = opts.allowedMimes || DEFAULT_ALLOWED_MIMES;
  const limits = opts.limits || DEFAULT_LIMITS;

  return multer({
    storage,
    limits,
    fileFilter: (_req, file, cb) => {
      if (!allowedMimes.length || allowedMimes.includes(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error(`Tipo de arquivo inválido: ${file.mimetype}`));
    }
  });
}

export const UploadDirectories = {
  public: publicFolder,
  private: privateFolder,
};
