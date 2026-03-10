/**
 * BaileysAdapter - Implementação da interface ITurboEngine usando Baileys
 * 
 * Este adapter encapsula a funcionalidade atual do Baileys,
 * permitindo que ele seja usado pelo EngineOrchestrator.
 */

import {
  WASocket,
  WAMessage,
  Contact as WAContact,
  GroupMetadata,
  isJidGroup,
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";

// isJidUser removido na v6 - usar verificação manual
const isJidUser = (jid: string | undefined): boolean => {
  if (!jid) return false;
  return jid.endsWith("@s.whatsapp.net");
};
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
import logger from "../../utils/logger";
import fs from "fs";
import path from "path";

// ============================================================================
// CAPABILITIES DO BAILEYS
// ============================================================================

const BAILEYS_CAPABILITIES: EngineCapabilities = {
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
  fetchHistoryReliable: false, // Bugado em multi-device
  
  // Contatos
  getProfilePicture: true,
  getContact: true,
  resolveLid: true,
  resolveLidReliable: false, // Instável
  
  // Features avançadas
  labels: false,
  stars: false,
  typingSimulation: false,
  businessFeatures: false,
  
  // Calls
  voiceCall: false,
  videoCall: false,
  screenShare: false,
};

const BAILEYS_INFO: EngineInfo = {
  type: "baileys",
  name: "Baileys",
  version: "6.17.16",
  description: "Socket-based WhatsApp Web API (sem browser)",
  capabilities: BAILEYS_CAPABILITIES,
  memoryUsage: 50, // 50MB estimado
  latency: 50, // 50ms estimado
};

// ============================================================================
// BAILEYS ADAPTER
// ============================================================================

export class BaileysAdapter implements ITurboEngine {
  readonly type: EngineType = "baileys";
  readonly info: EngineInfo = BAILEYS_INFO;

  private socket: WASocket | null = null;
  private status: EngineStatus = "disconnected";
  private health: HealthStatus = "healthy";
  
  private sessionId: string;
  private companyId: number;
  private whatsappId: number;
  private sessionPath: string;
  
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
    return this.status === "connected" && this.socket !== null;
  }

  // ============================================================================
  // CONEXÃO
  // ============================================================================

  async connect(): Promise<void> {
    if (this.socket) {
      logger.warn(`[BaileysAdapter] Socket já existe para ${this.sessionId}`);
      return;
    }

    this.status = "connecting";
    this.notifyConnectionUpdate({ status: "connecting" });

    try {
      // Carregar auth state
      const authPath = path.join(this.sessionPath, "auth");
      
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      
      // Obter versão mais recente do Baileys
      const { version } = await fetchLatestBaileysVersion();

      // Criar socket
      this.socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.appropriate("Desktop"),
        logger: {
          level: 'silent' as const,
          info: () => {},
          error: (obj: any) => logger.error(`[Baileys] ${obj}`),
          warn: (obj: any) => logger.warn(`[Baileys] ${obj}`),
          debug: () => {},
          trace: () => {},
          child: function() {
            return this;
          },
        },
        getMessage: async (key: any) => {
          // TODO: Implementar busca de mensagem no banco
          return { conversation: "" };
        },
      });

      // Event handlers
      this.setupEventHandlers(saveCreds);

      logger.info(`[BaileysAdapter] Socket criado para ${this.sessionId}`);
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
   * Configura os event handlers do socket Baileys
   */
  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection update
    this.socket.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = "connecting";
        this.notifyConnectionUpdate({
          status: "connecting",
          qrCode: qr,
          qrTimeout: 20,
        });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.output?.payload?.error || "unknown";

        if (statusCode === DisconnectReason.loggedOut) {
          this.status = "disconnected";
          this.health = "unhealthy";
          this.notifyConnectionUpdate({
            status: "disconnected",
            reason: "logged_out",
          });
        } else if (statusCode === DisconnectReason.restartRequired) {
          this.status = "reconnecting";
          this.notifyConnectionUpdate({
            status: "reconnecting",
            reason: "restart_required",
          });
          // Auto-reconnect
          setTimeout(() => this.reconnect(), 5000);
        } else {
          this.status = "disconnected";
          this.notifyConnectionUpdate({
            status: "disconnected",
            reason: reason,
            error: lastDisconnect?.error?.message,
          });
        }
      }

      if (connection === "open") {
        this.status = "connected";
        this.health = "healthy";
        this.notifyConnectionUpdate({
          status: "connected",
          isNewLogin: !fs.existsSync(path.join(this.sessionPath, "auth", "creds.json")),
        });
      }
    });

    // Credentials update
    this.socket.ev.on("creds.update", saveCreds);

    // Messages upsert
    this.socket.ev.on("messages.upsert", (data: any) => {
      const { messages, type } = data;
      
      for (const msg of messages) {
        if (type === "notify") {
          const turboMsg = this.convertMessage(msg);
          this.notifyMessage(turboMsg);
        }
      }
    });

    // Messages update
    this.socket.ev.on("messages.update", (updates: any[]) => {
      for (const update of updates) {
        // TODO: Converter e notificar
      }
    });

    // Presence update
    this.socket.ev.on("presence.update", (data: any) => {
      const { id, presences } = data;
      for (const [participant, presence] of Object.entries(presences)) {
        this.notifyPresenceUpdate({
          jid: id,
          participant,
          presence: presence as any,
        });
      }
    });

    // Contacts update
    this.socket.ev.on("contacts.upsert", (contacts: WAContact[]) => {
      const turboContacts = contacts.map(c => this.convertContact(c));
      this.notifyContactsUpdate(turboContacts);
    });

    // Chats update (grupos)
    this.socket.ev.on("chats.upsert", (chats: any[]) => {
      const groups = chats
        .filter(c => isJidGroup(c.id))
        .map(c => this.convertGroup(c));
      
      if (groups.length > 0) {
        this.notifyGroupsUpdate(groups);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.end(undefined);
      this.socket = null;
      this.status = "disconnected";
      this.notifyConnectionUpdate({ status: "disconnected" });
      logger.info(`[BaileysAdapter] Desconectado: ${this.sessionId}`);
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
        logger.error(`[BaileysAdapter] Erro em callback de conexão: ${error.message}`);
      }
    }
  }

  private notifyMessage(message: TurboMessage): void {
    for (const cb of this.messageCallbacks) {
      try {
        cb(message);
      } catch (error: any) {
        logger.error(`[BaileysAdapter] Erro em callback de mensagem: ${error.message}`);
      }
    }
  }

  private notifyPresenceUpdate(update: TurboPresenceUpdate): void {
    for (const cb of this.presenceCallbacks) {
      try {
        cb(update);
      } catch (error: any) {
        logger.error(`[BaileysAdapter] Erro em callback de presença: ${error.message}`);
      }
    }
  }

  private notifyContactsUpdate(contacts: TurboContact[]): void {
    for (const cb of this.contactsCallbacks) {
      try {
        cb(contacts);
      } catch (error: any) {
        logger.error(`[BaileysAdapter] Erro em callback de contatos: ${error.message}`);
      }
    }
  }

  private notifyGroupsUpdate(groups: TurboGroup[]): void {
    for (const cb of this.groupsCallbacks) {
      try {
        cb(groups);
      } catch (error: any) {
        logger.error(`[BaileysAdapter] Erro em callback de grupos: ${error.message}`);
      }
    }
  }

  // ============================================================================
  // ENVIO DE MENSAGENS
  // ============================================================================

  async sendText(to: string, text: string): Promise<TurboMessage> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    const waMessage = await this.socket.sendMessage(to, { text });
    return this.convertMessage(waMessage);
  }

  async sendMedia(
    to: string,
    media: Buffer | string,
    type: "image" | "video" | "audio" | "document",
    options?: { caption?: string; filename?: string; mimetype?: string }
  ): Promise<TurboMessage> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    let content: any;
    
    if (typeof media === "string") {
      // URL ou caminho de arquivo
      if (media.startsWith("http")) {
        content = { url: media };
      } else {
        content = fs.readFileSync(media);
      }
    } else {
      content = media;
    }

    // Construir mensagem com tipo correto
    let waMessage: WAMessage;
    
    if (type === "image") {
      waMessage = await this.socket.sendMessage(to, {
        image: content,
        caption: options?.caption,
      });
    } else if (type === "video") {
      waMessage = await this.socket.sendMessage(to, {
        video: content,
        caption: options?.caption,
      });
    } else if (type === "audio") {
      waMessage = await this.socket.sendMessage(to, {
        audio: content,
        mimetype: options?.mimetype || "audio/mp4",
      });
    } else {
      waMessage = await this.socket.sendMessage(to, {
        document: content,
        fileName: options?.filename || "document",
        mimetype: options?.mimetype,
        caption: options?.caption,
      });
    }

    return this.convertMessage(waMessage);
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
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    await this.socket.sendMessage(to, {
      react: {
        key: { remoteJid: to, id: messageId, fromMe: false },
        text: emoji,
      },
    });
  }

  async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    name?: string
  ): Promise<TurboMessage> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    const waMessage = await this.socket.sendMessage(to, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name,
      },
    });

    return this.convertMessage(waMessage);
  }

  async sendContact(to: string, contact: TurboContact): Promise<TurboMessage> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    const waMessage = await this.socket.sendMessage(to, {
      contacts: {
        displayName: contact.name || contact.phoneNumber || contact.jid,
        contacts: [
          {
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;type=CELL:${contact.phoneNumber}\nEND:VCARD`,
          },
        ],
      },
    });

    return this.convertMessage(waMessage);
  }

  // ============================================================================
  // HISTÓRICO
  // ============================================================================

  async fetchHistory(
    jid: string,
    options?: { limit?: number; before?: string; after?: string }
  ): Promise<TurboMessage[]> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    // NOTA: fetchMessageHistory é instável em multi-device
    // Ver BAILEYS-PATCHES.md para detalhes
    logger.warn(`[BaileysAdapter] fetchHistory chamado para ${jid} - pode ser instável`);

    try {
      // fetchMessageHistory é instável e retorna requestId ou array
      // Ver BAILEYS-PATCHES.md para detalhes
      // Assinatura: fetchMessageHistory(count, opts, jid) - mas instável
      const result: any = await (this.socket as any).fetchMessageHistory(
        options?.limit || 50,
        undefined,
        jid
      );

      // Resultado pode ser string (requestId) ou array de mensagens
      if (typeof result === 'string') {
        logger.info(`[BaileysAdapter] fetchHistory retornou requestId: ${result}`);
        return [];
      }

      if (Array.isArray(result)) {
        return result.map((m: any) => this.convertMessage(m));
      }

      return [];
    } catch (error: any) {
      logger.error(`[BaileysAdapter] Erro em fetchHistory: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // CONTATOS
  // ============================================================================

  async getProfilePicture(jid: string): Promise<string | null> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    try {
      const url = await this.socket.profilePictureUrl(jid, "image");
      return url || null;
    } catch {
      return null;
    }
  }

  async getContact(jid: string): Promise<TurboContact | null> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    // Baileys não expõe store diretamente, usar authState
    // Por ora, retornar contato básico
    return {
      id: jid,
      jid: jid,
      isGroup: isJidGroup(jid),
      lid: jid.includes("@lid") ? jid : undefined,
    };
  }

  async resolveLid(lid: string): Promise<string | null> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    // Tentar resolver LID via signalRepository
    try {
      const signalRepo = (this.socket as any).signalRepository;
      if (signalRepo?.lidMapping?.getPNForLID) {
        const lidId = lid.replace("@lid", "");
        const pn = await signalRepo.lidMapping.getPNForLID(lidId);
        return pn || null;
      }
    } catch (error: any) {
      logger.error(`[BaileysAdapter] Erro ao resolver LID: ${error.message}`);
    }

    return null;
  }

  // ============================================================================
  // GRUPOS
  // ============================================================================

  async getGroupMetadata(jid: string): Promise<TurboGroup | null> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    try {
      const metadata = await this.socket.groupMetadata(jid);
      return this.convertGroupMetadata(metadata);
    } catch {
      return null;
    }
  }

  async createGroup(name: string, participants: string[]): Promise<TurboGroup> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");

    const result = await this.socket.groupCreate(name, participants);
    return this.convertGroupMetadata(result);
  }

  async addParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");
    await this.socket.groupParticipantsUpdate(groupJid, [participantJid], "add");
  }

  async removeParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");
    await this.socket.groupParticipantsUpdate(groupJid, [participantJid], "remove");
  }

  async promoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");
    await this.socket.groupParticipantsUpdate(groupJid, [participantJid], "promote");
  }

  async demoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.socket) throw new Error("[BaileysAdapter] Socket não conectado");
    await this.socket.groupParticipantsUpdate(groupJid, [participantJid], "demote");
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  async ping(): Promise<boolean> {
    // Verificar se socket existe e está conectado
    if (!this.socket) return false;
    
    // Se status é "connected", considerar saudável
    // (não tentar enviar presença para evitar falsos negativos)
    return this.status === "connected";
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
    logger.info(`[BaileysAdapter] Destruído: ${this.sessionId}`);
  }

  // ============================================================================
  // CONVERSORES
  // ============================================================================

  private convertMessage(msg: WAMessage): TurboMessage {
    const message = msg.message || {};
    const messageType = Object.keys(message)[0] || "unknown";

    return {
      id: msg.key.id || "",
      from: msg.key.remoteJid || "",
      to: msg.key.fromMe ? msg.key.remoteJid || "" : "",
      body: this.getBodyFromMessage(message, messageType),
      timestamp: msg.messageTimestamp as number || Date.now(),
      fromMe: msg.key.fromMe || false,
      status: String(msg.status || ""),
      hasMedia: this.hasMedia(messageType),
      mediaType: this.getMediaType(messageType),
      participant: msg.key.participant,
    };
  }

  private convertContact(contact: WAContact): TurboContact {
    return {
      id: contact.id,
      jid: contact.id,
      name: contact.name || undefined,
      pushName: contact.notify || undefined,
      isGroup: isJidGroup(contact.id),
      lid: contact.id.includes("@lid") ? contact.id : undefined,
    };
  }

  private convertGroup(chat: any): TurboGroup {
    return {
      id: chat.id,
      jid: chat.id,
      name: chat.name || chat.subject || "",
      participants: [], // Será preenchido via groupMetadata
      subject: chat.subject,
      description: chat.desc,
    };
  }

  private convertGroupMetadata(metadata: GroupMetadata): TurboGroup {
    return {
      id: metadata.id,
      jid: metadata.id,
      name: metadata.subject || "",
      participants: metadata.participants.map(p => ({
        id: p.id,
        jid: p.id,
        name: undefined, // Será preenchido via contacts
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
        isSuperAdmin: p.admin === "superadmin",
      })),
      subject: metadata.subject,
      description: metadata.desc,
    };
  }

  private getBodyFromMessage(message: any, type: string): string {
    switch (type) {
      case "conversation":
        return message.conversation || "";
      case "extendedTextMessage":
        return message.extendedTextMessage?.text || "";
      case "imageMessage":
        return message.imageMessage?.caption || "";
      case "videoMessage":
        return message.videoMessage?.caption || "";
      case "documentMessage":
        return message.documentMessage?.caption || "";
      default:
        return "";
    }
  }

  private hasMedia(type: string): boolean {
    return ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].includes(type);
  }

  private getMediaType(type: string): "image" | "video" | "audio" | "document" | undefined {
    const map: Record<string, "image" | "video" | "audio" | "document"> = {
      imageMessage: "image",
      videoMessage: "video",
      audioMessage: "audio",
      documentMessage: "document",
      stickerMessage: "image",
    };
    return map[type];
  }
}

export default BaileysAdapter;
