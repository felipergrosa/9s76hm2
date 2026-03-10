/**
 * TurboWrapper - Wrapper retrocompatível para o Turbo Connector
 * 
 * Expõe a mesma interface do WASocket do Baileys, mas usa o
 * EngineOrchestrator por baixo com fallback automático.
 * 
 * Isso permite que o código existente continue funcionando sem
 * modificações, enquanto ganha os benefícios do fallback.
 */

import {
  WASocket,
  WAMessage,
  WAMessageKey,
  Contact as WAContact,
  GroupMetadata,
  AnyMessageContent,
  MiscMessageGenerationOptions,
} from "@whiskeysockets/baileys";
import { EngineOrchestrator, TurboFactory, TurboMessage, EngineType } from "./index";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import fs from "fs";
import path from "path";

// ============================================================================
// TIPOS
// ============================================================================

export interface TurboWrapperConfig {
  whatsapp: Whatsapp;
  sessionPath: string;
  mode?: "performance" | "stability" | "hybrid";
  engines?: EngineType[];
}

// ============================================================================
// TURBO WRAPPER
// ============================================================================

/**
 * Wrapper que implementa a interface do WASocket mas usa o orchestrator
 */
export class TurboWrapper implements Partial<WASocket> {
  private orchestrator: EngineOrchestrator;
  private baileysSocket: WASocket | null = null;
  private whatsapp: Whatsapp;
  private sessionPath: string;
  private initialized: boolean = false;

  // Event emitters (serão sobrescritos pelo Baileys socket real)
  public ev: any = {
    on: () => {},
    off: () => {},
    emit: () => {},
    removeAllListeners: () => {},
    process: () => () => {},
    buffer: () => {},
    createBufferedFunction: () => () => Promise.resolve(),
    flush: () => false,
    isBuffering: () => false,
  };

  // Store (compatibilidade com Baileys)
  public store: any = {
    chats: {},
    contacts: {},
    messages: {},
  };

  // User (compatibilidade com Baileys - necessário para getMeSocket)
  public user: { id: string; name: string } = {
    id: "",
    name: ""
  };

  constructor(config: TurboWrapperConfig) {
    this.whatsapp = config.whatsapp;
    this.sessionPath = config.sessionPath;
    
    // Criar orchestrator (ainda não inicializado)
    this.orchestrator = null as any; // Será criado no init()
  }

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================

  /**
   * Inicializa o wrapper com o orchestrator
   */
  async init(): Promise<WASocket> {
    if (this.initialized) {
      return this.baileysSocket!;
    }

    logger.info(`[TurboWrapper] Inicializando para whatsappId=${this.whatsapp.id}`);

    // Criar orchestrator
    this.orchestrator = await TurboFactory.createOrchestrator({
      sessionId: this.whatsapp.id.toString(),
      companyId: this.whatsapp.companyId,
      whatsappId: this.whatsapp.id,
      sessionPath: this.sessionPath,
      mode: this.getModeFromEnv(),
      engines: this.getEnginesFromEnv(),
    });

    // Obter engine Baileys do orchestrator para compatibilidade
    const baileysEngine = this.orchestrator.getPrimaryEngine();
    
    if (baileysEngine && baileysEngine.type === "baileys") {
      // Conectar o engine Baileys
      await baileysEngine.connect();
      
      // Obter socket Baileys interno (para compatibilidade total)
      this.baileysSocket = (baileysEngine as any).socket;
      
      // Copiar event emitter do Baileys
      if (this.baileysSocket) {
        this.ev = this.baileysSocket.ev;
        this.store = (this.baileysSocket as any).store || this.store;
        // Copiar user para compatibilidade com getMeSocket()
        if ((this.baileysSocket as any).user) {
          this.user = (this.baileysSocket as any).user;
        }
      }
    }

    this.initialized = true;
    logger.info(`[TurboWrapper] Inicializado com sucesso`);

    return this.baileysSocket!;
  }

  /**
   * Retorna o modo de operação das variáveis de ambiente
   */
  private getModeFromEnv(): "performance" | "stability" | "hybrid" {
    const mode = process.env.TURBO_MODE as any;
    
    if (["performance", "stability", "hybrid"].includes(mode)) {
      return mode;
    }
    
    return "hybrid"; // Default
  }

  /**
   * Retorna os engines das variáveis de ambiente
   */
  private getEnginesFromEnv(): EngineType[] | undefined {
    const engines = process.env.TURBO_ENGINES;
    
    if (engines) {
      return engines.split(",").map(e => e.trim() as EngineType);
    }
    
    return undefined; // Usa o padrão do modo
  }

  // ============================================================================
  // MÉTODOS DE ENVIO (COM Fallback)
  // ============================================================================

  /**
   * Envia mensagem com fallback automático
   */
  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: MiscMessageGenerationOptions
  ): Promise<WAMessage> {
    // Se temos socket Baileys e está conectado, usar diretamente
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.sendMessage(jid, content, options);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no sendMessage: ${error.message}`);
        
        // Tentar fallback via orchestrator
        return await this.sendMessageWithFallback(jid, content, options);
      }
    }

    // Fallback via orchestrator
    return await this.sendMessageWithFallback(jid, content, options);
  }

  /**
   * Envia mensagem usando o orchestrator (com fallback)
   */
  private async sendMessageWithFallback(
    jid: string,
    content: AnyMessageContent,
    options?: MiscMessageGenerationOptions
  ): Promise<WAMessage> {
    // Detectar tipo de mensagem
    const messageType = this.getMessageType(content);
    
    let turboMsg: TurboMessage;

    if (messageType === "text") {
      turboMsg = await this.orchestrator.sendText(jid, (content as any).text);
    } else if (messageType === "image" || messageType === "video" || messageType === "audio" || messageType === "document") {
      turboMsg = await this.orchestrator.sendMedia(
        jid,
        (content as any)[messageType],
        messageType,
        {
          caption: (content as any).caption,
          filename: (content as any).fileName,
          mimetype: (content as any).mimetype,
        }
      );
    } else {
      // Fallback para Baileys direto
      if (this.baileysSocket) {
        return await this.baileysSocket.sendMessage(jid, content, options);
      }
      throw new Error(`[TurboWrapper] Tipo de mensagem não suportado: ${messageType}`);
    }

    // Converter TurboMessage para WAMessage (compatibilidade)
    return this.convertTurboToWAMessage(turboMsg);
  }

  /**
   * Detecta o tipo de mensagem
   */
  private getMessageType(content: AnyMessageContent): string {
    if ((content as any).text) return "text";
    if ((content as any).image) return "image";
    if ((content as any).video) return "video";
    if ((content as any).audio) return "audio";
    if ((content as any).document) return "document";
    if ((content as any).sticker) return "sticker";
    if ((content as any).location) return "location";
    if ((content as any).contacts) return "contact";
    if ((content as any).react) return "reaction";
    
    return "unknown";
  }

  /**
   * Converte TurboMessage para WAMessage (stub para compatibilidade)
   */
  private convertTurboToWAMessage(msg: TurboMessage): WAMessage {
    return {
      key: {
        id: msg.id,
        remoteJid: msg.from,
        fromMe: msg.fromMe,
        participant: msg.participant,
      },
      message: {
        conversation: msg.body,
      } as any,
      messageTimestamp: msg.timestamp,
      status: msg.status as any,
    } as WAMessage;
  }

  // ============================================================================
  // MÉTODOS DE GRUPO (Com Fallback)
  // ============================================================================

  async groupMetadata(jid: string): Promise<GroupMetadata> {
    // Preferir Baileys para grupos
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.groupMetadata(jid);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no groupMetadata: ${error.message}`);
      }
    }

    // Fallback via orchestrator
    const group = await this.orchestrator.execute("groupOperations", engine => engine.getGroupMetadata(jid));
    
    if (group) {
      return {
        id: group.jid,
        subject: group.name,
        participants: group.participants.map(p => ({
          id: p.jid,
          admin: p.isSuperAdmin ? "superadmin" : p.isAdmin ? "admin" : null,
        })),
        subjectOwner: undefined,
        subjectTime: undefined,
        creation: undefined,
        owner: undefined,
        desc: group.description,
        descId: undefined,
        restrict: undefined,
        announce: undefined,
        size: undefined,
      } as GroupMetadata;
    }

    throw new Error(`[TurboWrapper] Falha ao obter metadata do grupo ${jid}`);
  }

  async groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: "add" | "remove" | "promote" | "demote"
  ): Promise<any> {
    // Preferir Baileys para operações de grupo
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.groupParticipantsUpdate(jid, participants, action);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no groupParticipantsUpdate: ${error.message}`);
      }
    }

    // Fallback via orchestrator
    for (const participant of participants) {
      if (action === "add") {
        await this.orchestrator.execute("groupOperations", engine => 
          engine.addParticipant(jid, participant)
        );
      } else if (action === "remove") {
        await this.orchestrator.execute("groupOperations", engine => 
          engine.removeParticipant(jid, participant)
        );
      } else if (action === "promote") {
        await this.orchestrator.execute("groupOperations", engine => 
          engine.promoteParticipant(jid, participant)
        );
      } else if (action === "demote") {
        await this.orchestrator.execute("groupOperations", engine => 
          engine.demoteParticipant(jid, participant)
        );
      }
    }

    return [];
  }

  // ============================================================================
  // MÉTODOS DE CONTATO (Com Fallback)
  // ============================================================================

  async profilePictureUrl(jid: string, type: "image" | "preview" = "image"): Promise<string | null> {
    // Preferir Baileys para profile pictures
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.profilePictureUrl(jid, type);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no profilePictureUrl: ${error.message}`);
      }
    }

    // Fallback via orchestrator
    return await this.orchestrator.getProfilePicture(jid);
  }

  async onWhatsApp(...phoneNumbers: string[]): Promise<Array<{ jid: string; exists: boolean }>> {
    // Preferir Baileys para onWhatsApp
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.onWhatsApp(...phoneNumbers);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no onWhatsApp: ${error.message}`);
      }
    }

    // Fallback: assumir que existe se tem formato válido
    return phoneNumbers.map(jid => ({ jid, exists: true }));
  }

  // ============================================================================
  // MÉTODOS DE PRESENÇA
  // ============================================================================

  async sendPresenceUpdate(type: string, jid?: string): Promise<void> {
    if (this.baileysSocket && this.isBaileysHealthy()) {
      try {
        return await this.baileysSocket.sendPresenceUpdate(type as any, jid);
      } catch (error: any) {
        logger.warn(`[TurboWrapper] Baileys falhou no sendPresenceUpdate: ${error.message}`);
      }
    }
  }

  async presenceSubscribe(jid: string): Promise<void> {
    if (this.baileysSocket) {
      return await this.baileysSocket.presenceSubscribe(jid);
    }
  }

  // ============================================================================
  // MÉTODOS DE HISTÓRICO (Com Fallback Inteligente)
  // ============================================================================

  /**
   * Busca histórico de mensagens
   * 
   * IMPORTANTE: Baileys é instável para fetchMessageHistory,
   * então usamos WEBJS como engine primário para esta operação.
   */
  async fetchMessageHistory(...args: any[]): Promise<any> {
    // Usar orchestrator com feature routing (WEBJS primário)
    logger.info(`[TurboWrapper] fetchMessageHistory via orchestrator (WEBJS primário)`);
    
    // Extrair argumentos
    const count = args[0] || 50;
    const options = args[1];
    const jid = args[2] || options?.jid || options?.remoteJid;
    
    if (jid) {
      const messages = await this.orchestrator.fetchHistory(jid, { limit: count });
      return messages;
    }

    // Fallback para Baileys se não tem JID
    if (this.baileysSocket) {
      return await (this.baileysSocket as any).fetchMessageHistory(...args);
    }

    return [];
  }

  // ============================================================================
  // MÉTODOS DE LID RESOLUTION (Com Fallback Inteligente)
  // ============================================================================

  /**
   * Resolve LID para número de telefone
   * 
   * IMPORTANTE: WEBJS é mais estável para LID resolution.
   */
  async resolveLid(lid: string): Promise<string | null> {
    return await this.orchestrator.resolveLid(lid);
  }

  // ============================================================================
  // MÉTODOS DE CONEXÃO
  // ============================================================================

  async end(reason?: any): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.destroy();
    }
    
    if (this.baileysSocket) {
      await this.baileysSocket.end(reason);
    }
    
    this.initialized = false;
    logger.info(`[TurboWrapper] Finalizado`);
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Verifica se o engine Baileys está saudável
   */
  private isBaileysHealthy(): boolean {
    if (!this.baileysSocket) return false;
    
    // Verificar via health report do orchestrator
    const healthReport = this.orchestrator?.getHealthReport();
    
    if (healthReport?.baileys) {
      return healthReport.baileys.health !== "unhealthy";
    }
    
    return true; // Assumir saudável se não tem report
  }

  // ============================================================================
  // EVENT HANDLING (Compatibilidade)
  // ============================================================================

  private eventListeners: Map<string, Function[]> = new Map();

  private setupEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  private removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error: any) {
        logger.error(`[TurboWrapper] Erro em event listener: ${error.message}`);
      }
    }
  }

  // ============================================================================
  // PROXY PARA MÉTODOS NÃO IMPLEMENTADOS
  // ============================================================================

  /**
   * Proxy para métodos não implementados (delegar para Baileys)
   */
  get(key: string): any {
    if (this.baileysSocket && (this.baileysSocket as any)[key]) {
      return (this.baileysSocket as any)[key];
    }
    
    return undefined;
  }
}

// ============================================================================
// FUNÇÕES DE HELPER
// ============================================================================

/**
 * Cria um wrapper turbo para uma sessão WhatsApp
 */
export async function createTurboWrapper(config: TurboWrapperConfig): Promise<TurboWrapper> {
  const wrapper = new TurboWrapper(config);
  await wrapper.init();
  return wrapper;
}

export default TurboWrapper;
