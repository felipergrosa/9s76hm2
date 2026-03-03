import Baileys from "../../models/Baileys";
import cacheLayer from "../../libs/cache";
import path from "path";
import fs from "fs";
import logger from "../../utils/logger";

const DeleteBaileysService = async (id: string | number, options?: { 
  clearFilesOnly?: boolean;  // Nova opção: limpar apenas arquivos
  keepDatabase?: boolean;    // Nova opção: manter dados no banco
}): Promise<void> => {
  const { clearFilesOnly = false, keepDatabase = false } = options || {};

  // Se não for "clearFilesOnly", remove do banco como antes
  if (!clearFilesOnly && !keepDatabase) {
    const baileysData = await Baileys.findOne({
      where: {
        whatsappId: id
      }
    });

    if (baileysData) {
      await baileysData.destroy();
    }
  }

  // Limpar arquivos da sessão (sempre executa)
  try {
    const whatsappId = Number(id);
    if (!isNaN(whatsappId)) {
      
      // Tentar encontrar companyId para montar path correto
      let companyId = 1; // Default
      
      try {
        const Whatsapp = require("../models/Whatsapp").default;
        const whatsapp = await Whatsapp.findByPk(whatsappId);
        if (whatsapp && whatsapp.companyId) {
          companyId = whatsapp.companyId;
        }
      } catch (err) {
        logger.warn(`[DeleteBaileysService] Não foi possível obter companyId para whatsappId=${whatsappId}, usando default=1`);
      }

      // Limpar arquivos da sessão no filesystem
      const sessionDir = path.resolve(
        process.cwd(),
        "src",
        "wbot",
        "sessions",
        companyId.toString(),
        whatsappId.toString()
      );

      if (fs.existsSync(sessionDir)) {
        logger.info(`[DeleteBaileysService] Limpando arquivos da sessão: ${sessionDir}`);
        
        // Listar arquivos antes de deletar (log)
        const files = fs.readdirSync(sessionDir);
        logger.debug(`[DeleteBaileysService] Arquivos encontrados: ${files.join(", ")}`);
        
        // Remover diretório inteiro
        fs.rmSync(sessionDir, { recursive: true, force: true });
        logger.info(`[DeleteBaileysService] Sessão ${whatsappId} limpa do filesystem`);
      } else {
        logger.debug(`[DeleteBaileysService] Diretório da sessão não encontrado: ${sessionDir}`);
      }
    }

    // Limpar cache Redis (sempre executa)
    const driver = (process.env.SESSIONS_DRIVER || "").toLowerCase() || (process.env.REDIS_URI ? "redis" : "fs");
    
    if (driver === "redis") {
      await cacheLayer.delFromPattern(`sessions:${id}:*`);
      logger.debug(`[DeleteBaileysService] Cache Redis limpo para sessão ${id}`);
    }

  } catch (e) {
    logger.error(`[DeleteBaileysService] Erro ao limpar sessão ${id}:`, e);
  }
};

export default DeleteBaileysService;
