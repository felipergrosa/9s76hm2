import path from "path";
import multer from "multer";
import fs from "fs";
import { Request } from "express";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import { isEmpty, isNil } from "lodash";
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { getBucketByMime, buildContactAvatarPath, buildContactMediaBucketPath, buildFilemanagerBucketPath, sanitizeFileName } from "../utils/publicPath";

// Interface de Request estendido
interface UploadRequest extends Request {
  user?: {
    id: string;
    profile: string;
    companyId: number;
  };
  body: {
    typeArch: string;
    fileId: string;
  };
}

const publicFolder = path.resolve(__dirname, "..", "..", "public");
const safeSegment = (value: unknown): string => {
  const segment = String(value || "");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(segment)) {
    throw new Error("Invalid upload path segment");
  }
  return segment;
};

const assertInside = (root: string, target: string): void => {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Upload path outside company directory");
  }
};

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req: UploadRequest, file, cb) {
      let companyId: number | undefined;

      // Verificação segura de usuário e companyId
      if (req.user?.companyId) {
        companyId = req.user.companyId;
      }

      // Se companyId não estiver disponível, buscar por token do Whatsapp
      if (!companyId) {
        try {
          const authHeader = req.headers.authorization;

          if (authHeader) {
            const [, token] = authHeader.split(" ");

            if (token) {
              const whatsapp = await Whatsapp.findOne({
                where: { token },
                attributes: ['companyId']
              });

              if (whatsapp?.companyId) {
                companyId = whatsapp.companyId;
              }
            }
          }
        } catch (error) {
          console.error("Erro ao buscar companyId:", error);
        }
      }

      // Validação final de companyId
      if (!companyId) {
        const err = new Error("Não foi possível determinar o companyId");
        return cb(err, null);
      }

      // Determinar pasta de destino
      const { typeArch, fileId, contactUuid, category } = req.body as any;
      let folder: string;

      try {
      switch (typeArch) {
        case "announcements": {
          folder = path.resolve(publicFolder, typeArch);
          break;
        }
        case "logo": {
          folder = path.resolve(publicFolder);
          break;
        }
        case "contact": {
          if (!contactUuid) {
            const err = new Error("Faltou contactUuid para upload de contato");
            return cb(err, null);
          }
          const safeContactUuid = safeSegment(contactUuid);
          if (category === "avatar") {
            const rel = buildContactAvatarPath(companyId!, safeContactUuid);
            folder = path.resolve(publicFolder, rel);
          } else {
            const bucket = getBucketByMime(file.mimetype);
            const rel = buildContactMediaBucketPath(companyId!, safeContactUuid, bucket);
            folder = path.resolve(publicFolder, rel);
          }
          break;
        }
        case "filemanager": {
          const bucket = getBucketByMime(file.mimetype);
          const rel = buildFilemanagerBucketPath(companyId!, bucket);
          folder = path.resolve(publicFolder, rel);
          break;
        }
        default: {
          const isQuickMessageUpload =
            req.path?.includes("/quick-messages/") &&
            req.path?.includes("/media-upload");

          if (isQuickMessageUpload) {
            folder = path.resolve(
              publicFolder,
              `company${companyId}`,
              "quickMessage"
            );
            break;
          }

          // ✅ NOVO: Detectar se é upload de mensagem (rota /messages/:ticketId)
          const ticketId = req.params?.ticketId || (req.path?.match(/\/messages\/(\d+)/) || [])[1];
          
          if (ticketId) {
            // É upload de mensagem! Buscar contactId do ticket
            const ticket = await Ticket.findOne({
              where: { id: ticketId, companyId },
              attributes: ['contactId']
            });
            if (!ticket?.contactId) {
              throw new Error("Ticket not found in upload company");
            }
            folder = path.resolve(
              publicFolder,
              `company${companyId}`,
              `contact${ticket.contactId}`
            );
            break;
          }
          
          // Fallback: Compatibilidade com estrutura antiga
          folder = path.resolve(
            publicFolder,
            `company${companyId}`,
            typeArch ? safeSegment(typeArch) : '',
            fileId ? safeSegment(fileId) : ''
          );
        }
      }

      // Validate the final path even when a future branch adds new upload types.
        const isSharedAsset = typeArch === "announcements" || typeArch === "logo";
        assertInside(isSharedAsset ? publicFolder : path.resolve(publicFolder, `company${companyId}`), folder);
        fs.mkdirSync(folder, { recursive: true });
        // Permissão 755: owner rwx, group/other rx (antes era 777, excessivo).
        fs.chmodSync(folder, 0o755);
        return cb(null, folder);
      } catch (error) {
        console.error("[Upload] Erro ao criar pasta:", error);
        return cb(error as Error, null);
      }
    },
    filename(req: UploadRequest, file, cb) {
      const { typeArch, category } = req.body as any;

      // Nome determinístico para avatar de contato
      if (typeArch === "contact" && category === "avatar") {
        const ext = path.extname(file.originalname) || ".jpg";
        const fileName = `avatar${ext.toLowerCase()}`;
        return cb(null, sanitizeFileName(fileName));
      }

      // Geração do nome do arquivo (timestamp para announcements, original para demais)
      const baseName = sanitizeFileName(file.originalname);
      if (!baseName || baseName === "." || baseName === ".." || baseName.length > 200) {
        return cb(new Error("Invalid upload filename"), "");
      }
      const fileName = typeArch && typeArch !== "announcements"
        ? baseName
        : `${Date.now()}_${baseName}`;

      return cb(null, fileName);
    }
  }),

  // Limites de upload
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10 // Permitir até 10 arquivos por vez
  },

  // Filtro de arquivo com tratamento de erro
  fileFilter: (req: UploadRequest, file, cb) => {
    const allowedMimes = [
      // Imagens
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',

      // Documentos
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/rtf',
      'text/rtf',
      // Office
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Compactados
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.rar',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      // Fallback: browsers/servidores sem mimetype conhecido enviam
      // octet-stream — necessário para "qualquer tipo de arquivo".
      // Extensões renderizáveis/executáveis continuam bloqueadas abaixo.
      'application/octet-stream',

      // Áudio (permitir formatos comuns usados por navegadores e celulares)
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/opus',
      'audio/wav',
      'audio/webm',
      'audio/aac',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/3gpp',
      'audio/3gpp2',
      'audio/amr',

      // Vídeo comum (evita erro ao enviar vídeo pelo mesmo endpoint)
      'video/mp4',
      'video/3gpp',
      'video/webm',
      'video/quicktime',
      'video/mpeg',
      'video/avi'
    ];

    // Extensões que renderizam/executam no domínio do backend quando servidas
    // por express.static (html/svg/js) — bloqueadas para não reabrir XSS
    // armazenado, independente do mimetype declarado.
    if (/\.(x?html?|svg|js|mjs)$/i.test(file.originalname || "")) {
      return cb(new Error("Extensão de arquivo não permitida"));
    }

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo inválido: ${file.mimetype}`));
    }
  }
};
