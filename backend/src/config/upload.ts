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

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req: UploadRequest, file, cb) {
      console.log(`[Upload] Iniciando upload. File: ${file.originalname}, mimetype: ${file.mimetype}`);
      console.log(`[Upload] publicFolder: ${publicFolder}`);
      
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
          if (category === "avatar") {
            const rel = buildContactAvatarPath(companyId!, contactUuid);
            folder = path.resolve(publicFolder, rel);
          } else {
            const bucket = getBucketByMime(file.mimetype);
            const rel = buildContactMediaBucketPath(companyId!, contactUuid, bucket);
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
          // ✅ NOVO: Detectar se é upload de mensagem (rota /messages/:ticketId)
          const ticketId = req.params?.ticketId || (req.path?.match(/\/messages\/(\d+)/) || [])[1];
          
          if (ticketId) {
            // É upload de mensagem! Buscar contactId do ticket
            try {
              const ticket = await Ticket.findByPk(ticketId, { attributes: ['contactId'] });
              if (ticket?.contactId) {
                // Salvar em contact{id}/
                folder = path.resolve(
                  publicFolder,
                  `company${companyId}`,
                  `contact${ticket.contactId}`
                );
                break;
              }
            } catch (err) {
              console.error("Erro ao buscar ticket para upload:", err);
            }
          }
          
          // Fallback: Compatibilidade com estrutura antiga
          folder = path.resolve(
            publicFolder,
            `company${companyId}`,
            typeArch || '',
            fileId || ''
          );
        }
      }

      // Criar pasta de forma segura
      try {
        console.log(`[Upload] Criando pasta: ${folder}`);
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
        console.log(`[Upload] Pasta criada com sucesso. Callback com folder: ${folder}`);
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

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo inválido: ${file.mimetype}`));
    }
  }
};
