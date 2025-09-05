import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as fs from "fs";
import * as path from "path";
import * as Sentry from "@sentry/node";

import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import { getIO } from "../../libs/socket";
import { getWbot } from "../../libs/wbot";
import axios from "axios";
import { buildContactAvatarPath, buildGroupAvatarPath, sanitizeFileName } from "../../utils/publicPath";

interface Request {
  contactId: number | string;
  companyId: number;
  whatsappId?: number;
}

const ensureFolder = (absoluteFolder: string) => {
  if (!fs.existsSync(absoluteFolder)) {
    fs.mkdirSync(absoluteFolder, { recursive: true });
    fs.chmodSync(absoluteFolder, 0o777);
  }
  return absoluteFolder;
};

const downloadProfileImage = async (profilePicUrl: string, folder: string, filename: string) => {
  try {
    const response = await axios.get(profilePicUrl, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 15000,
      headers: {
        // Alguns CDNs exigem um User-Agent realista
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://web.whatsapp.com/"
      }
    });
    fs.writeFileSync(join(folder, filename), response.data);
    return filename;
  } catch (error) {
    logger.warn("Falha ao baixar imagem de perfil", error);
    return null;
  }
};

const AVATAR_BASENAME = "avatar.jpg";

// Throttle interno: 1x por 24h por contato (escopo do processo)
const lastAvatarRefreshMap = new Map<string, number>();

const RefreshContactAvatarService = async ({ contactId, companyId, whatsappId }: Request): Promise<Contact | null> => {
  try {
    const contact = await Contact.findOne({
      where: { id: contactId },
      attributes: [
        "id",
        "companyId",
        "name",
        "number",
        "isGroup",
        "channel",
        "remoteJid",
        "whatsappId",
        "profilePicUrl",
        "urlPicture",
        "uuid"
      ]
    });

    if (!contact || contact.companyId !== companyId) return contact;

    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const contactUuid = (contact as any).uuid as string;
    const isGroup = !!contact.isGroup;
    // Determina JID do grupo (sanitizado) quando for grupo
    const groupJid = isGroup
      ? (contact.remoteJid && contact.remoteJid.includes("@")
          ? contact.remoteJid
          : `${contact.number}@g.us`)
      : "";

    // Caminhos com company para o filesystem
    const relativeAvatarDirFs = isGroup
      ? buildGroupAvatarPath(companyId, groupJid)
      : buildContactAvatarPath(companyId, contactUuid);
    const absoluteAvatarDir = ensureFolder(path.resolve(publicFolder, relativeAvatarDirFs));
    // Caminho salvo no banco, relativo à raiz da company
    const relativeAvatarDirDb = isGroup
      ? path.posix.join("groups", sanitizeFileName(groupJid), "avatar")
      : path.posix.join("contacts", contactUuid, "avatar");
    const desiredFilename = AVATAR_BASENAME;
    const desiredPath = path.join(absoluteAvatarDir, desiredFilename);
    const desiredExists = fs.existsSync(desiredPath);

    let newProfileUrl = contact.profilePicUrl;

    // Early-exit se atualizado há menos de 24h
    const key = `${companyId}:${contact.id}`;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const last = lastAvatarRefreshMap.get(key) || 0;
    if (now - last <= DAY) {
      return contact;
    }

    const resolvedWhatsappId = contact.whatsappId || whatsappId;
    // Logs detalhados removidos para reduzir ruído

    if (contact.channel === "whatsapp" && resolvedWhatsappId) {
      try {
        const wbot = getWbot(resolvedWhatsappId);
        const jid = contact.remoteJid
          ? contact.remoteJid
          : contact.isGroup
            ? `${contact.number}@g.us`
            : `${contact.number}@s.whatsapp.net`;
        newProfileUrl = await wbot.profilePictureUrl(jid, "image");

        // Atualiza também o nome do grupo se for grupo
        if (contact.isGroup) {
          let groupName = "Grupo desconhecido";
          try {
            const groupMeta = await wbot.groupMetadata(jid);
            if (groupMeta && groupMeta.subject && groupMeta.subject.trim() !== "") {
              groupName = groupMeta.subject;
            }
          } catch (e) {
            // silencioso
          }
          await contact.update({ name: groupName });
          await contact.reload();
        }
        // Atualização de nome de contato comum
        if (!contact.isGroup) {
          const nomeAtual = (contact.name || '').trim();
          // Verifica se o nome é igual ao número (apenas dígitos, sem +, espaços, etc)
          const soNumero = nomeAtual.replace(/\D/g, "");
          if (soNumero === contact.number) {
            let nomeNovo = nomeAtual;
            try {
              const contatoMeta = await wbot.onWhatsApp(jid) as Array<{ jid: string; exists: unknown; lid?: unknown; notify?: string }>;
              if (Array.isArray(contatoMeta) && contatoMeta[0] && typeof contatoMeta[0].notify === 'string' && contatoMeta[0].notify.trim() !== "") {
                nomeNovo = contatoMeta[0].notify;
              } else {
                // Fallback: tenta buscar perfil business se notify não veio
                try {
                  const businessProfile = await wbot.getBusinessProfile(jid);
                  // Tente os campos conhecidos do WABusinessProfile
                  let nomeBusiness = '';
                  if (businessProfile) {
                    // Alguns campos possíveis: description, businessDescription, address, category
                    if (typeof businessProfile.description === 'string' && businessProfile.description.trim() !== '') {
                      nomeBusiness = businessProfile.description;
                    }
                  }
                  if (
                    nomeBusiness &&
                    nomeBusiness.replace(/\D/g, '') !== contact.number
                  ) {
                    nomeNovo = nomeBusiness;
                  }
                } catch (err) {
                  // silencioso
                }
              }
            } catch (e) {
              // silencioso
            }
            if (nomeNovo !== nomeAtual && nomeNovo && nomeNovo.replace(/\D/g, "") !== contact.number) {
              await contact.update({ name: nomeNovo });
              await contact.reload();
            }
          }
        }
      } catch (e) {
        Sentry.captureException(e);
        newProfileUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }
    } else if (contact.profilePicUrl) {
      // Para outros canais (facebook/instagram), se já houver uma URL e não houver arquivo local, baixa.
      newProfileUrl = contact.profilePicUrl;
    }

    // Considerar arquivo legado salvo com outro nome: se não existe o arquivo desejado, vamos baixar
    let shouldRedownload = !desiredExists || newProfileUrl !== contact.profilePicUrl;

    // Não substituir por fallback se já existe uma imagem local válida
    const fallbackUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
    if (newProfileUrl === fallbackUrl && desiredExists) {
      shouldRedownload = false;
    }

    // Se o arquivo salvo tem nome diferente do desejado, força redownload para corrigir
    // Remoção do arquivo desejado se URL mudou e queremos baixar novamente
    if (desiredExists && shouldRedownload) {
      try {
        fs.unlinkSync(desiredPath);
      } catch (e) {
        // silencioso
      }
    }

    // Função auxiliar para adotar arquivo legado
    const tryAdoptLegacyAvatar = (): boolean => {
      try {
        const candidates: string[] = [];
        const legacyDbPath = contact.getDataValue("urlPicture");
        if (legacyDbPath && typeof legacyDbPath === "string") {
          // Se era relativo diretamente (ex.: 5519....jpeg), considerar relativo à raiz da company
          const rel = legacyDbPath.includes("/") ? legacyDbPath : path.posix.join("contacts", legacyDbPath);
          candidates.push(path.resolve(publicFolder, `company${companyId}`, rel));
        }
        // Candidatos por número do contato em formatos comuns
        const exts = [".jpeg", ".jpg", ".png", ".webp"];
        for (const ext of exts) {
          candidates.push(path.resolve(publicFolder, `company${companyId}`, "contacts", `${contact.number}${ext}`));
        }

        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            // Garante pasta destino e copia para o nome padronizado
            ensureFolder(absoluteAvatarDir);
            try {
              fs.copyFileSync(cand, desiredPath);
            } catch (copyErr) {
              // Caso copy falhe, tentar rename (move)
              try {
                fs.renameSync(cand, desiredPath);
              } catch (renameErr) {
                // silencioso
                continue;
              }
            }
            return true;
          }
        }
      } catch (e) {}
      return false;
    };

    if (newProfileUrl && shouldRedownload) {
      const filename = await downloadProfileImage(newProfileUrl, absoluteAvatarDir, desiredFilename);
      if (filename) {
        const relativePathForDb = path.posix.join(relativeAvatarDirDb, filename);
        await contact.update({ profilePicUrl: newProfileUrl, urlPicture: relativePathForDb, pictureUpdated: true });
        await contact.reload();

        // Emite evento Socket.IO para atualização em tempo real
        const io = getIO();
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
          action: "update",
          contact: {
            id: contact.id,
            name: contact.name,
            urlPicture: contact.urlPicture,
            updatedAt: contact.updatedAt
          }
        });
      } else {
        // silencioso
        // Tentar adotar avatar legado se houver
        if (!fs.existsSync(desiredPath) && tryAdoptLegacyAvatar()) {
          const relativePathForDb = path.posix.join(relativeAvatarDirDb, desiredFilename);
          try {
            await contact.update({ urlPicture: relativePathForDb, pictureUpdated: true });
            await contact.reload();
          } catch (e) {
            // silencioso
          }
        }
      }
    }

    // Se já existe um avatar no local desejado, mas o campo urlPicture está vazio, adota o caminho relativo padronizado
    if (!contact.getDataValue("urlPicture") && desiredExists) {
      const relativePathForDb = path.posix.join(relativeAvatarDirDb, desiredFilename);
      try {
        await contact.update({ urlPicture: relativePathForDb, pictureUpdated: true });
        await contact.reload();
      } catch (e) {
        // silencioso
      }
    }

    // marca o último refresh
    lastAvatarRefreshMap.set(key, now);
    return contact;
  } catch (err) {
    Sentry.captureException(err);
    logger.error("Erro ao atualizar avatar do contato", err);
    return null;
  }
};

export default RefreshContactAvatarService;
