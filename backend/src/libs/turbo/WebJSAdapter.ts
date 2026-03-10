/**
 * WebJSAdapter - Implementação da interface ITurboEngine usando whatsapp-web.js
 * 
 * Este adapter usa Puppeteer para controlar o WhatsApp Web via browser.
 * Mais estável que Baileys, mas com maior consumo de memória.
 */

import {
  ITurboEngine,
  EngineType,
  EngineInfo,
  EngineStatus,
  HealthStatus,
  TurboMessage,
  TurboContact,
  TurboGroup,
  TurboConnectionUpdate,
  TurboMessageUpdate,
  TurboPresenceUpdate,
  OnConnectionUpdate,
  OnMessage,
  OnMessageUpdate,
  OnPresenceUpdate,
  OnContactsUpdate,
  OnGroupsUpdate,
  EngineCapabilities,
} from "./ITurboEngine";
import { Client, LocalAuth, Message, Contact, Chat, GroupChat } from "whatsapp-web.js";
import logger from "../../utils/logger";
import fs from "fs";
import path from "path";

// ============================================================================
// CAPABILITIES DO WEBJS
// ============================================================================

const WEBJS_CAPABILITIES: EngineCapabilities = {
  // Mensagens
  sendText: true,
  sendMedia: true,
  sendDocument: true,
  sendReaction: true,
  sendLocation: true,
  sendContact: true,
  
  // Grupos
  createGroup: true,
  addParticipant: true,
  removeParticipant: true,
  promoteParticipant: true,
  demoteParticipant: true,
  getGroupMetadata: true,
  setGroupSubject: true,
  setGroupDescription: true,
  
  // Histórico
  fetchHistory: true,
  fetchHistoryReliable: true, // ✅ Mais estável que Baileys
  
  // Contatos
  getProfilePicture: true,
  getContact: true,
  resolveLid: true,
  resolveLidReliable: true, // ✅ Mais estável que Baileys
  
  // Features avançadas
  labels: false,
  stars: false,
  typingSimulation: true, // ✅ Suporta simulação de digitação
  businessFeatures: false,
  
  // Calls
  voiceCall: false,
  videoCall: false,
  screenShare: false,
};

const WEBJS_INFO: EngineInfo = {
  type: "webjs",
  name: "whatsapp-web.js",
  version: "1.23.0",
  description: "Puppeteer-based WhatsApp Web API (browser automation)",
  capabilities: WEBJS_CAPABILITIES,
  memoryUsage: 300, // 300MB estimado (browser overhead)
  latency: 200, // 200ms estimado (browser + Puppeteer)
};

// ============================================================================
// WEBJS ADAPTER
// ============================================================================

export class WebJSAdapter implements ITurboEngine {
  readonly type: EngineType = "webjs";
  readonly info: EngineInfo = WEBJS_INFO;

  private client: Client | null = null;
  private status: EngineStatus = "disconnected";
  private health: HealthStatus = "healthy";
  
  private sessionId: string;
  private companyId: number;
  private whatsappId: number;
  private sessionPath: string;
  
  // QR Code atual
  private currentQrCode: string | null = null;
  
  // Callbacks
  private connectionCallbacks: OnConnectionUpdate[] = [];
  private messageCallbacks: OnMessage[] = [];
  private messageUpdateCallbacks: OnMessageUpdate[] = [];
  private presenceCallbacks: OnPresenceUpdate[] = [];
  private contactsCallbacks: OnContactsUpdate[] = [];
  private groupsCallbacks: OnGroupsUpdate[] = [];

  constructor(config: {
    sessionId: string;
    companyId: number;
    whatsappId: number;
    sessionPath: string;
  }) {
    this.sessionId = config.sessionId;
    this.companyId = config.companyId;
    this.whatsappId = config.whatsappId;
    this.sessionPath = config.sessionPath;
  }

  // ============================================================================
  // ESTADO
  // ============================================================================

  getStatus(): EngineStatus {
    return this.status;
  }

  getHealth(): HealthStatus {
    return this.health;
  }

  isConnected(): boolean {
    return this.status === "connected" && this.client !== null;
  }

  // ============================================================================
  // CONEXÃO
  // ============================================================================

  async connect(): Promise<void> {
    if (this.client) {
      logger.warn(`[WebJSAdapter] Client já existe para ${this.sessionId}`);
      return;
    }

    this.status = "connecting";
    this.notifyConnectionUpdate({ status: "connecting" });

    try {
      // Criar diretório de sessão
      const authPath = path.join(this.sessionPath, "webjs-session");
      
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      // Criar client Puppeteer
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: authPath,
          clientId: this.sessionId,
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
          ],
        },
      });

      // Event handlers
      this.setupEventHandlers();

      // Inicializar
      await this.client.initialize();

      logger.info(`[WebJSAdapter] Client criado para ${this.sessionId}`);
    } catch (error: any) {
      this.status = "error";
      this.health = "unhealthy";
      this.notifyConnectionUpdate({
        status: "error",
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Configura os event handlers do client whatsapp-web.js
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    // QR Code
    this.client.on("qr", (qr: string) => {
      this.currentQrCode = qr;
      this.status = "connecting";
      this.notifyConnectionUpdate({
        status: "connecting",
        qrCode: qr,
        qrTimeout: 20,
      });
      logger.info(`[WebJSAdapter] QR Code gerado para ${this.sessionId}`);
    });

    // Ready (conectado)
    this.client.on("ready", () => {
      this.status = "connected";
      this.health = "healthy";
      this.currentQrCode = null;
      this.notifyConnectionUpdate({
        status: "connected",
        isNewLogin: false, // TODO: Detectar se é novo login
      });
      logger.info(`[WebJSAdapter] Conectado: ${this.sessionId}`);
    });

    // Disconnected
    this.client.on("disconnected", (reason: string) => {
      this.status = "disconnected";
      this.notifyConnectionUpdate({
        status: "disconnected",
        reason: reason,
      });
      logger.warn(`[WebJSAdapter] Desconectado: ${this.sessionId} - ${reason}`);
    });

    // Auth failure
    this.client.on("auth_failure", (error: Error) => {
      this.status = "error";
      this.health = "unhealthy";
      this.notifyConnectionUpdate({
        status: "error",
        reason: "auth_failure",
        error: error.message,
      });
      logger.error(`[WebJSAdapter] Falha de autenticação: ${error.message}`);
    });

    // Message received
    this.client.on("message", (message: Message) => {
      if (!message.fromMe) {
        const turboMsg = this.convertMessage(message);
        this.notifyMessage(turboMsg);
      }
    });

    // Message create (enviadas)
    this.client.on("message_create", (message: Message) => {
      if (message.fromMe) {
        const turboMsg = this.convertMessage(message);
        this.notifyMessage(turboMsg);
      }
    });

    // Group join
    this.client.on("group_join", (notification: any) => {
      logger.info(`[WebJSAdapter] Group join: ${notification.chatId}`);
    });

    // Group leave
    this.client.on("group_leave", (notification: any) => {
      logger.info(`[WebJSAdapter] Group leave: ${notification.chatId}`);
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.status = "disconnected";
      this.notifyConnectionUpdate({ status: "disconnected" });
      logger.info(`[WebJSAdapter] Desconectado: ${this.sessionId}`);
    }
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  // ============================================================================
  // EVENTOS
  // ============================================================================

  onConnectionUpdate(callback: OnConnectionUpdate): void {
    this.connectionCallbacks.push(callback);
  }

  onMessage(callback: OnMessage): void {
    this.messageCallbacks.push(callback);
  }

  onMessageUpdate(callback: OnMessageUpdate): void {
    this.messageUpdateCallbacks.push(callback);
  }

  onPresenceUpdate(callback: OnPresenceUpdate): void {
    this.presenceCallbacks.push(callback);
  }

  onContactsUpdate(callback: OnContactsUpdate): void {
    this.contactsCallbacks.push(callback);
  }

  onGroupsUpdate(callback: OnGroupsUpdate): void {
    this.groupsCallbacks.push(callback);
  }

  private notifyConnectionUpdate(update: TurboConnectionUpdate): void {
    for (const cb of this.connectionCallbacks) {
      try {
        cb(update);
      } catch (error: any) {
        logger.error(`[WebJSAdapter] Erro em callback de conexão: ${error.message}`);
      }
    }
  }

  private notifyMessage(message: TurboMessage): void {
    for (const cb of this.messageCallbacks) {
      try {
        cb(message);
      } catch (error: any) {
        logger.error(`[WebJSAdapter] Erro em callback de mensagem: ${error.message}`);
      }
    }
  }

  // ============================================================================
  // ENVIO DE MENSAGENS
  // ============================================================================

  async sendText(to: string, text: string): Promise<TurboMessage> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    const message = await this.client.sendMessage(to, text);
    return this.convertMessage(message);
  }

  async sendMedia(
    to: string,
    media: Buffer | string,
    type: "image" | "video" | "audio" | "document",
    options?: { caption?: string; filename?: string; mimetype?: string }
  ): Promise<TurboMessage> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    let message: Message;

    if (typeof media === "string" && media.startsWith("http")) {
      // URL
      const mediaAttachment = await this.getMessageMediaFromUrl(media, type);
      message = await this.client.sendMessage(to, mediaAttachment, {
        caption: options?.caption,
      });
    } else if (typeof media === "string") {
      // Caminho de arquivo
      message = await this.client.sendMessage(to, {
        [type]: media,
        caption: options?.caption,
      } as any);
    } else {
      // Buffer
      const mediaAttachment = this.getMessageMediaFromBuffer(media, type, options?.mimetype);
      message = await this.client.sendMessage(to, mediaAttachment, {
        caption: options?.caption,
      });
    }

    return this.convertMessage(message);
  }

  async sendDocument(
    to: string,
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<TurboMessage> {
    return this.sendMedia(to, buffer, "document", { filename, mimetype });
  }

  async sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    // whatsapp-web.js suporta reactions via message.reaction()
    const msg = await this.client.getMessageById(messageId);
    if (msg) {
      await msg.react(emoji);
    }
  }

  async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    name?: string
  ): Promise<TurboMessage> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    const message = await this.client.sendMessage(to, {
      location: {
        latitude,
        longitude,
        name,
      },
    } as any);

    return this.convertMessage(message);
  }

  async sendContact(to: string, contact: TurboContact): Promise<TurboMessage> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    const message = await this.client.sendMessage(to, {
      contact: {
        name: contact.name || contact.phoneNumber || contact.jid,
        number: contact.phoneNumber,
      },
    } as any);

    return this.convertMessage(message);
  }

  // ============================================================================
  // HISTÓRICO
  // ============================================================================

  async fetchHistory(
    jid: string,
    options?: { limit?: number; before?: string; after?: string }
  ): Promise<TurboMessage[]> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    try {
      const chat = await this.client.getChatById(jid);
      
      if (!chat) {
        return [];
      }

      // Buscar mensagens
      const messages = await chat.fetchMessages({
        limit: options?.limit || 50,
      });

      return messages.map(m => this.convertMessage(m));
    } catch (error: any) {
      logger.error(`[WebJSAdapter] Erro em fetchHistory: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // CONTATOS
  // ============================================================================

  async getProfilePicture(jid: string): Promise<string | null> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    try {
      const contact = await this.client.getContactById(jid);
      const url = await contact.getProfilePicUrl();
      return url || null;
    } catch {
      return null;
    }
  }

  async getContact(jid: string): Promise<TurboContact | null> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    try {
      const contact = await this.client.getContactById(jid);
      return this.convertContact(contact);
    } catch {
      return null;
    }
  }

  async resolveLid(lid: string): Promise<string | null> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    // whatsapp-web.js resolve LIDs automaticamente via contact.number
    try {
      const contact = await this.client.getContactById(lid);
      if (contact && contact.number) {
        return contact.number;
      }
    } catch (error: any) {
      logger.error(`[WebJSAdapter] Erro ao resolver LID: ${error.message}`);
    }

    return null;
  }

  // ============================================================================
  // GRUPOS
  // ============================================================================

  async getGroupMetadata(jid: string): Promise<TurboGroup | null> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    try {
      const chat = await this.client.getChatById(jid);
      
      if (chat.isGroup) {
        const groupChat = chat as GroupChat;
        return this.convertGroupChat(groupChat);
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async createGroup(name: string, participants: string[]): Promise<TurboGroup> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");

    const result = await this.client.createGroup(name, participants);
    
    // createGroup retorna CreateGroupResult ou string
    const groupId = typeof result === "string" ? result : (result as any).gid || result;
    
    // Buscar metadata do grupo criado
    const chat = await this.client.getChatById(groupId as string) as GroupChat;
    return this.convertGroupChat(chat);
  }

  async addParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(groupJid) as GroupChat;
    await chat.addParticipants([participantJid]);
  }

  async removeParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(groupJid) as GroupChat;
    await chat.removeParticipants([participantJid]);
  }

  async promoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(groupJid) as GroupChat;
    await chat.promoteParticipants([participantJid]);
  }

  async demoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(groupJid) as GroupChat;
    await chat.demoteParticipants([participantJid]);
  }

  // ============================================================================
  // TYPING SIMULATION
  // ============================================================================

  async simulateTyping(to: string, duration: number): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(to);
    await chat.sendStateTyping();
    
    // Aguardar duração
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Parar de digitar
    await chat.clearState();
  }

  async simulateRecording(to: string, duration: number): Promise<void> {
    if (!this.client) throw new Error("[WebJSAdapter] Client não conectado");
    
    const chat = await this.client.getChatById(to);
    await chat.sendStateRecording();
    
    // Aguardar duração
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Parar de gravar
    await chat.clearState();
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  async ping(): Promise<boolean> {
    if (!this.client) return false;

    try {
      // Tentar obter estado de conexão
      const state = await this.client.getState();
      return state === "CONNECTED";
    } catch {
      return false;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async destroy(): Promise<void> {
    await this.disconnect();
    this.connectionCallbacks = [];
    this.messageCallbacks = [];
    this.messageUpdateCallbacks = [];
    this.presenceCallbacks = [];
    this.contactsCallbacks = [];
    this.groupsCallbacks = [];
    logger.info(`[WebJSAdapter] Destruído: ${this.sessionId}`);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async getMessageMediaFromUrl(url: string, type: string): Promise<any> {
    // Baixar e converter para MessageMedia
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.getMessageMediaFromBuffer(buffer, type);
  }

  private getMessageMediaFromBuffer(buffer: Buffer, type: string, mimetype?: string): any {
    const { MessageMedia } = require("whatsapp-web.js");
    const base64 = buffer.toString("base64");
    
    const mimetypes: Record<string, string> = {
      image: "image/jpeg",
      video: "video/mp4",
      audio: "audio/mp4",
      document: mimetype || "application/octet-stream",
    };

    return new MessageMedia(
      mimetypes[type] || mimetype || "application/octet-stream",
      base64
    );
  }

  // ============================================================================
  // CONVERSORES
  // ============================================================================

  private convertMessage(msg: Message): TurboMessage {
    return {
      id: msg.id._serialized,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      status: msg.ack?.toString(),
      hasMedia: msg.hasMedia,
      mediaType: msg.type as any,
      participant: msg.author,
    };
  }

  private convertContact(contact: Contact): TurboContact {
    return {
      id: contact.id._serialized,
      jid: contact.id._serialized,
      name: contact.name || contact.pushname || undefined,
      pushName: contact.pushname || undefined,
      isGroup: contact.isGroup,
      phoneNumber: contact.number || undefined,
    };
  }

  private convertGroupChat(chat: GroupChat): TurboGroup {
    return {
      id: chat.id._serialized,
      jid: chat.id._serialized,
      name: chat.name,
      participants: chat.participants.map(p => ({
        id: p.id._serialized,
        jid: p.id._serialized,
        name: undefined,
        isAdmin: p.isAdmin,
        isSuperAdmin: p.isSuperAdmin,
      })),
    };
  }
}

export default WebJSAdapter;
