/**
 * Serviço de manutenção: limpa avatares placeholder/corrompidos no banco.
 * Roda automaticamente no startup do backend (background, não bloqueante).
 * 
 * Características:
 * - Idempotente: executar múltiplas vezes não causa problemas
 * - Limitado: processa no máximo MAX_CONTACTS por execução
 * - Não-bloqueante: não impede o servidor de subir
 */

import * as fs from "fs";
import * as path from "path";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";

const MIN_AVATAR_SIZE = 100; // bytes
const MAX_CONTACTS = 5000;   // limite de segurança por execução
const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

/**
 * Verifica se o arquivo físico existe e tem tamanho válido
 */
const isAvatarFileValid = (companyId: number, rawUrlPicture: string | null): boolean => {
  if (!rawUrlPicture || rawUrlPicture === "nopicture.png" || rawUrlPicture.includes("nopicture")) {
    return false;
  }

  // Montar caminho físico esperado
  let relativePath = rawUrlPicture;
  if (!relativePath.includes("/")) {
    relativePath = `contacts/${relativePath}`;
  }

  // Extrair apenas o caminho relativo se houver URL absoluta no banco
  if (relativePath.includes("http")) {
    const contactsMatch = relativePath.match(/\/contacts\/([^?]+)/);
    if (contactsMatch) {
      relativePath = `contacts/${contactsMatch[1]}`;
    } else {
      const publicMatch = relativePath.match(/\/public\/company\d+\/(.+?)(\?|$)/);
      if (publicMatch) {
        relativePath = publicMatch[1];
      }
    }
  }

  const expectedPath = path.resolve(publicFolder, `company${companyId}`, relativePath);

  try {
    const stats = fs.statSync(expectedPath);
    return stats.size >= MIN_AVATAR_SIZE;
  } catch (e) {
    return false;
  }
};

/**
 * Limpa avatares placeholder/corrompidos no banco.
 * Roda em background — não bloqueia o startup.
 */
export const cleanCorruptedAvatars = async (): Promise<void> => {
  const startAt = Date.now();
  let cleaned = 0;
  let checked = 0;

  try {
    // Buscar contatos que possivelmente tenham placeholder ou arquivo local
    const contacts = await Contact.findAll({
      where: {
        [Op.or]: [
          // URL aponta para placeholder
          { urlPicture: "nopicture.png" },
          { urlPicture: { [Op.like]: "%nopicture%" } },
          // profilePicUrl é placeholder
          { profilePicUrl: { [Op.like]: "%nopicture.png%" } },
          // urlPicture vazio
          { urlPicture: "" },
          // profilePicUrl vazio
          { profilePicUrl: "" },
          // Tem arquivo local (verificaremos existência depois)
          { urlPicture: { [Op.ne]: null } }
        ]
      },
      attributes: ["id", "companyId", "urlPicture", "profilePicUrl"],
      limit: MAX_CONTACTS,
      order: [["id", "ASC"]]
    });

    for (const contact of contacts) {
      checked++;
      let shouldUpdate = false;
      let newUrlPicture: string | null = null;
      let newProfilePicUrl: string | null = null;

      const rawUrlPicture = contact.getDataValue("urlPicture") || "";
      const rawProfilePicUrl = contact.getDataValue("profilePicUrl") || "";

      // 1. Limpar urlPicture se for placeholder
      if (rawUrlPicture === "nopicture.png" || rawUrlPicture.includes("nopicture")) {
        newUrlPicture = null;
        shouldUpdate = true;
      }

      // 2. Limpar profilePicUrl se for placeholder
      if (rawProfilePicUrl.includes("nopicture.png")) {
        newProfilePicUrl = null;
        shouldUpdate = true;
      }

      // 3. Limpar urlPicture vazia
      if (rawUrlPicture === "") {
        newUrlPicture = null;
        shouldUpdate = true;
      }

      // 4. Limpar profilePicUrl vazia
      if (rawProfilePicUrl === "") {
        newProfilePicUrl = null;
        shouldUpdate = true;
      }

      // 5. Verificar se arquivo físico existe e é válido
      if (rawUrlPicture && rawUrlPicture !== "nopicture.png" && !rawUrlPicture.includes("nopicture")) {
        const fileValid = isAvatarFileValid(contact.companyId, rawUrlPicture);
        if (!fileValid) {
          newUrlPicture = null;
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        const updateData: any = {};
        if (newUrlPicture === null) {
          updateData.urlPicture = null;
          updateData.pictureUpdated = false;
        }
        if (newProfilePicUrl === null) {
          updateData.profilePicUrl = null;
        }

        await contact.update(updateData);
        cleaned++;
      }
    }

    const duration = Date.now() - startAt;
    logger.info(
      `[CleanAvatars] Verificados: ${checked} | Limpos: ${cleaned} | Tempo: ${duration}ms`
    );
  } catch (err) {
    logger.error(`[CleanAvatars] Erro ao executar limpeza: ${(err as any)?.message || err}`);
  }
};
