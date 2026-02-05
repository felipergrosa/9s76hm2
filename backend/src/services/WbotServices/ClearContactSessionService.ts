import Whatsapp from "../../models/Whatsapp";
import { BufferJSON } from "@whiskeysockets/baileys";
import logger from "../../utils/logger";

interface ClearContactSessionData {
  whatsappId: number;
  contactJid: string; // Ex: "5519999999999@s.whatsapp.net" ou "247540473708749@lid"
}

/**
 * Serviço para limpar a sessão criptográfica de um contato específico.
 * Útil para resolver erros de "Bad MAC" e "No matching sessions found"
 * sem precisar reconectar todo o WhatsApp.
 */
const ClearContactSessionService = async ({
  whatsappId,
  contactJid
}: ClearContactSessionData): Promise<{ success: boolean; message: string }> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (!whatsapp) {
      return { success: false, message: "WhatsApp não encontrado" };
    }

    if (!whatsapp.session) {
      return { success: false, message: "Sessão não encontrada" };
    }

    // Parse da sessão
    const sessionData = JSON.parse(whatsapp.session, BufferJSON.reviver);
    const { creds, keys } = sessionData;

    if (!keys) {
      return { success: false, message: "Chaves de sessão não encontradas" };
    }

    let cleared = false;
    const clearedItems: string[] = [];

    // Limpar sessão do contato (sessions)
    if (keys.sessions && keys.sessions[contactJid]) {
      delete keys.sessions[contactJid];
      cleared = true;
      clearedItems.push("session");
    }

    // Limpar sender keys do contato (senderKeys)
    if (keys.senderKeys) {
      const senderKeyPattern = contactJid.split("@")[0];
      for (const key of Object.keys(keys.senderKeys)) {
        if (key.includes(senderKeyPattern)) {
          delete keys.senderKeys[key];
          cleared = true;
          clearedItems.push(`senderKey:${key}`);
        }
      }
    }

    // Limpar sender key memory (senderKeyMemory)
    if (keys.senderKeyMemory) {
      const senderKeyPattern = contactJid.split("@")[0];
      for (const key of Object.keys(keys.senderKeyMemory)) {
        if (key.includes(senderKeyPattern)) {
          delete keys.senderKeyMemory[key];
          cleared = true;
          clearedItems.push(`senderKeyMemory:${key}`);
        }
      }
    }

    // Limpar LID mapping se for um LID
    if (contactJid.includes("@lid") && keys.lidMapping) {
      const lidNumber = contactJid.split("@")[0];
      if (keys.lidMapping[lidNumber]) {
        delete keys.lidMapping[lidNumber];
        cleared = true;
        clearedItems.push("lidMapping");
      }
    }

    if (!cleared) {
      return { 
        success: false, 
        message: `Nenhuma sessão encontrada para o contato ${contactJid}` 
      };
    }

    // Salvar sessão atualizada
    await whatsapp.update({
      session: JSON.stringify({ creds, keys }, BufferJSON.replacer, 0)
    });

    logger.info({
      message: `[ClearContactSession] Sessão limpa para contato`,
      whatsappId,
      contactJid,
      clearedItems
    });

    return { 
      success: true, 
      message: `Sessão limpa com sucesso: ${clearedItems.join(", ")}. O contato precisará enviar uma nova mensagem para re-estabelecer a criptografia.`
    };

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
