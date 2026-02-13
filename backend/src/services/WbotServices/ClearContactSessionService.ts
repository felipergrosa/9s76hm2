import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import cacheLayer from "../../libs/cache";
import path from "path";
import fs from "fs";
import * as crypto from "crypto";

interface ClearContactSessionData {
  whatsappId: number;
  contactJid: string;
}

const sanitizeFileName = (name: string) => {
  const valid = name
    .replace(/[<>:\\"/\\|?*]/g, "_")
    .replace(/@/g, "_at_")
    .replace(/::/g, "__");
  const hash = crypto.createHash("md5").update(name).digest("hex").slice(0, 6);
  return `${valid}-${hash}`;
};

const ClearContactSessionService = async ({
  whatsappId,
  contactJid
}: ClearContactSessionData): Promise<{ success: boolean; message: string }> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      return { success: false, message: "WhatsApp não encontrado" };
    }

    const driver = (process.env.SESSIONS_DRIVER || "").toLowerCase() || (process.env.REDIS_URI ? "redis" : "fs");
    const clearedItems: string[] = [];

    // Keys usually associated with a contact session
    const keyTypes = [
      `session-${contactJid}`,
      `sender-key-${contactJid}`,
      `sender-key-memory-${contactJid}`,
      // LIDs might have their own keys
      ...(contactJid.includes("@lid") ? [`lid-mapping-${contactJid.split("@")[0]}`] : [])
    ];

    if (driver === "redis") {
      for (const keyType of keyTypes) {
        const redisKey = `sessions:${whatsappId}:${keyType}`;
        const exists = await cacheLayer.get(redisKey);
        if (exists) {
          await cacheLayer.del(redisKey);
          clearedItems.push(keyType);
        }
      }

      // Also pattern match for sender keys if exact match failed or to be thorough
      // Note: Redis KEYS/SCAN is expensive, so we try specific keys first. 
      // Given Baileys v6 MultiFileAuthState structure, keys are exact files.

    } else {
      // FS Driver
      const baseDir = path.resolve(
        process.cwd(),
        process.env.SESSIONS_DIR || "private/sessions",
        String(whatsapp.companyId || "0"),
        String(whatsappId)
      );

      for (const keyType of keyTypes) {
        const fileName = `${sanitizeFileName(keyType)}.json`;
        const filePath = path.join(baseDir, fileName);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          clearedItems.push(keyType);
        }
      }
    }

    if (clearedItems.length === 0) {
      return {
        success: false,
        message: `Nenhuma sessão encontrada para o contato ${contactJid} (Driver: ${driver})`
      };
    }

    const message = `Sessão limpa com sucesso (${driver}): ${clearedItems.length} arquivos removidos.`;
    logger.info({
      message: `[ClearContactSession] ${message}`,
      whatsappId,
      contactJid,
      clearedItems
    });

    return { success: true, message };

  } catch (error) {
    logger.error({
      message: `[ClearContactSession] Erro ao limpar sessão`,
      whatsappId,
      contactJid,
      error: error.message
    });

    return {
      success: false,
      message: `Erro ao limpar sessão: ${error.message}`
    };
  }
};

export default ClearContactSessionService;
