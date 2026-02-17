/**
 * PERSISTENT MESSAGE STORE - Cache Local de Mensagens
 * Implementação com feature flag para não afetar o sistema existente
 */
import fs from 'fs';
import path from 'path';
import logger from "../../utils/logger";

// Feature flag
const ENABLE_PERSISTENT_STORE = process.env.ENABLE_PERSISTENT_STORE === "true";

// Diretório para armazenar os dados
const STORE_DIR = path.join(__dirname, "../../private/messageStore");

/**
 * Inicializa o store persistente
 */
export function initializePersistentStore(): void {
  if (!ENABLE_PERSISTENT_STORE) return;
  
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
      logger.info(`[PersistentStore] Diretório criado: ${STORE_DIR}`);
    }
  } catch (error) {
    logger.error(`[PersistentStore] Erro na inicialização: ${error.message}`);
  }
}

/**
 * Salva mensagem no store persistente
 */
export function saveMessageToStore(sessionId: string, messageId: string, messageData: any): void {
  if (!ENABLE_PERSISTENT_STORE) return;
  
  try {
    const sessionDir = path.join(STORE_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    const filePath = path.join(sessionDir, `${messageId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      ...messageData,
      storedAt: Date.now()
    }, null, 2));
  } catch (error) {
    logger.error(`[PersistentStore] Erro ao salvar mensagem: ${error.message}`);
  }
}

/**
 * Busca mensagem no store persistente
 */
export function getMessageFromStore(sessionId: string, messageId: string): any | null {
  if (!ENABLE_PERSISTENT_STORE) return null;
  
  try {
    const filePath = path.join(STORE_DIR, sessionId, `${messageId}.json`);
    if (!fs.existsSync(filePath)) return null;
    
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`[PersistentStore] Erro ao buscar mensagem: ${error.message}`);
    return null;
  }
}

/**
 * Remove mensagem do store persistente
 */
export function removeMessageFromStore(sessionId: string, messageId: string): void {
  if (!ENABLE_PERSISTENT_STORE) return;
  
  try {
    const filePath = path.join(STORE_DIR, sessionId, `${messageId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error(`[PersistentStore] Erro ao remover mensagem: ${error.message}`);
  }
}

/**
 * Limpa todas as mensagens de uma sessão
 */
export function clearSessionStore(sessionId: string): void {
  if (!ENABLE_PERSISTENT_STORE) return;
  
  try {
    const sessionDir = path.join(STORE_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      logger.info(`[PersistentStore] Store da sessão ${sessionId} limpo`);
    }
  } catch (error) {
    logger.error(`[PersistentStore] Erro ao limpar sessão: ${error.message}`);
  }
}

/**
 * Lista todas as mensagens de uma sessão
 */
export function listSessionMessages(sessionId: string): string[] {
  if (!ENABLE_PERSISTENT_STORE) return [];
  
  try {
    const sessionDir = path.join(STORE_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) return [];
    
    return fs.readdirSync(sessionDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    logger.error(`[PersistentStore] Erro ao listar mensagens: ${error.message}`);
    return [];
  }
}

/**
 * Wrapper para buscar mensagem em múltiplas camadas
 * 1. Store persistente (se habilitado)
 * 2. Store do Baileys (passado como parâmetro)
 * 3. Database (deve ser implementado externamente)
 */
export async function findMessageInLayers(
  sessionId: string,
  messageId: string,
  baileysStore?: any,
  dbFindFunction?: (id: string) => Promise<any>
): Promise<any | null> {
  // Camada 1: Store persistente
  if (ENABLE_PERSISTENT_STORE) {
    const persisted = getMessageFromStore(sessionId, messageId);
    if (persisted) {
      logger.debug(`[PersistentStore] Mensagem ${messageId} encontrada no store persistente`);
      return persisted;
    }
  }
  
  // Camada 2: Store do Baileys
  if (baileysStore) {
    try {
      const baileysMessage = baileysStore.messages.get(messageId);
      if (baileysMessage) {
        logger.debug(`[PersistentStore] Mensagem ${messageId} encontrada no store Baileys`);
        return baileysMessage;
      }
    } catch (error) {
      logger.error(`[PersistentStore] Erro ao buscar no store Baileys: ${error.message}`);
    }
  }
  
  // Camada 3: Database
  if (dbFindFunction) {
    try {
      const dbMessage = await dbFindFunction(messageId);
      if (dbMessage) {
        logger.debug(`[PersistentStore] Mensagem ${messageId} encontrada no database`);
        return dbMessage;
      }
    } catch (error) {
      logger.error(`[PersistentStore] Erro ao buscar no database: ${error.message}`);
    }
  }
  
  logger.debug(`[PersistentStore] Mensagem ${messageId} não encontrada em nenhuma camada`);
  return null;
}
