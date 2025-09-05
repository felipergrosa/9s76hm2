import "dotenv/config";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { Op } from "sequelize";
// Initialize database/models
import "../database";

import logger from "../utils/logger"; // fallback if needed
// Models
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";

import {
  buildContactMediaBucketPath,
  buildGroupMediaBucketPath,
  buildCompanyBase,
  sanitizeFileName,
} from "../utils/publicPath";

/**
 * Decide bucket a partir de mediaType (image, video, audio, document, others)
 * Se possível, tenta por extensão/mimetype como fallback.
 */
function bucketFrom(message: Message): "images" | "videos" | "audio" | "documents" | "others" {
  const t = (message.getDataValue("mediaType") || "").toString().toLowerCase();
  if (t.startsWith("image")) return "images";
  if (t.startsWith("video")) return "videos";
  if (t.startsWith("audio")) return "audio";
  if (t.includes("document")) return "documents";

  // fallback por extensão
  const file = (message.getDataValue("mediaUrl") || "").toString();
  const ext = path.extname(file).replace(".", "");
  const mt = (ext && mime.lookup(ext)) || null;
  if (mt) {
    const type = mt.toString().split("/")[0];
    if (type === "image") return "images";
    if (type === "video") return "videos";
    if (type === "audio") return "audio";
    // documentos comuns
    const docs = [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (docs.includes(mt.toString())) return "documents";
  }
  return "others";
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

async function moveFile(src: string, dest: string) {
  await ensureDir(path.dirname(dest));
  try {
    await fs.promises.rename(src, dest);
  } catch (e) {
    // se rename falhar (disco distinto, permissão), faz copy+unlink
    try {
      await fs.promises.copyFile(src, dest);
      await fs.promises.unlink(src);
    } catch (err) {
      throw err;
    }
  }
}

async function main() {
  const onlyCompanyId = process.env.COMPANY_ID ? Number(process.env.COMPANY_ID) : undefined;
  const publicRoot = path.resolve(__dirname, "..", "..", "public");

  // Seleciona mensagens com mediaUrl "legado": sem barra (apenas nome de arquivo) OU que começam com `companyX/`
  const where: any = {
    mediaUrl: {
      [Op.ne]: null,
    },
  };
  const legacyNoSlash = { mediaUrl: { [Op.notLike]: "%/%" } };
  const legacyWithCompanyPrefix = { mediaUrl: { [Op.like]: "company%/%" } };
  // companyId opcional
  if (onlyCompanyId) {
    where.companyId = onlyCompanyId;
  }

  const candidates = await Message.findAll({
    where: {
      [Op.and]: [where],
      [Op.or]: [legacyNoSlash, legacyWithCompanyPrefix],
    },
    include: [
      {
        model: Ticket,
        attributes: ["id", "companyId", "contactId"],
        include: [
          {
            model: Contact,
            attributes: ["id", "uuid", "isGroup", "number", "remoteJid"],
          },
        ],
      },
    ],
  });

  let moved = 0;
  for (const msg of candidates) {
    try {
      const ticket: any = msg.get("Ticket");
      if (!ticket) continue;
      const companyId: number = ticket.companyId;
      const contact: any = ticket.Contact;
      if (!companyId || !contact) continue;

      // Determina caminho atual absoluto
      let currentRel = (msg.getDataValue("mediaUrl") || "").toString();
      // Se vier com prefixo companyX/, manter; senão, prefixar
      const companyPrefix = buildCompanyBase(companyId);
      if (!currentRel.startsWith(companyPrefix + "/")) {
        currentRel = path.posix.join(companyPrefix, currentRel);
      }
      const absSrc = path.resolve(publicRoot, currentRel);
      if (!fs.existsSync(absSrc)) {
        continue; // arquivo não está onde esperávamos
      }

      // Decide bucket e destino
      const bucket = bucketFrom(msg);
      const isGroup = !!contact.isGroup;
      const groupJid = isGroup
        ? (contact.remoteJid && String(contact.remoteJid).includes("@")
            ? String(contact.remoteJid)
            : `${contact.number}@g.us`)
        : "";
      const contactUuid = (contact.uuid || sanitizeFileName(String(contact.id))) as string;

      const relativeDir = isGroup
        ? buildGroupMediaBucketPath(companyId, groupJid, bucket)
        : buildContactMediaBucketPath(companyId, contactUuid, bucket);

      const fileName = path.posix.basename(currentRel);
      const absDest = path.resolve(publicRoot, relativeDir, fileName);

      await moveFile(absSrc, absDest);

      // Atualiza mediaUrl no DB para relativo à raiz da company (sem companyX/)
      const dbRelativeDir = relativeDir.replace(new RegExp(`^${companyPrefix}/`), "");
      const newMediaUrl = path.posix.join(dbRelativeDir, fileName);
      await msg.update({ mediaUrl: newMediaUrl });
      moved++;
    } catch (e: any) {
      console.error("[migrateLegacyMedia] erro ao migrar mensagem", msg.id, e?.message || e);
    }
  }

  console.log(`[migrateLegacyMedia] concluído: ${moved} arquivos movidos/atualizados`);
}

main().catch((e) => {
  console.error("[migrateLegacyMedia] falha geral", e);
  process.exit(1);
});
