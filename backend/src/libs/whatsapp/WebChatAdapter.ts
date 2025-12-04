/**
 * WebChatAdapter.ts
 * 
 * Adapter para WebChat (chat embeddable em sites)
 * Implementa IWhatsAppAdapter para integração com IA/RAG
 * 
 * Diferente dos outros adapters, o WebChat usa WebSocket para comunicação em tempo real
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import logger from "../../utils/logger";
import {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";

interface WebChatAdapterConfig {
  widgetId: string;           // ID único do widget
  companyId: number;          // ID da empresa
  queueId?: number;           // Fila padrão para novos chats
  greeting?: string;          // Mensagem de boas-vindas
  offlineMessage?: string;    // Mensagem quando offline
  primaryColor?: string;      // Cor principal do widget
  position?: "left" | "right"; // Posição do widget
}

interface WebChatSession {
  sessionId: string;
  recipientId: string;
  socket: Socket;
  contactName?: string;
  contactEmail?: string;
  startedAt: Date;
  lastActivity: Date;
}

export class WebChatAdapter implements IWhatsAppAdapter {
  readonly whatsappId: number;
  readonly channelType: "baileys" | "official" = "official";
  
  private config: WebChatAdapterConfig;
  private io: SocketIOServer | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";
  private messageCallback?: (message: IWhatsAppMessage) => void;
  private connectionCallback?: (status: ConnectionStatus) => void;
  
  // Sessões ativas de chat
  private sessions: Map<string, WebChatSession> = new Map();
  
  // Identificador do canal
  readonly channel: "webchat" = "webchat";
  
  constructor(whatsappId: number, config: WebChatAdapterConfig) {
    this.whatsappId = whatsappId;
    this.config = config;
    
    logger.info(`[WebChatAdapter] Criado para whatsappId=${whatsappId}, widgetId=${config.widgetId}`);
  }
  
  /**
   * Inicializa o adapter com servidor Socket.IO
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[WebChatAdapter] Inicializando whatsappId=${this.whatsappId}`);
      
      // O Socket.IO server é injetado externamente
      // Aqui apenas marcamos como conectado
      this.connectionStatus = "connected";
      
      logger.info(`[WebChatAdapter] Pronto para receber conexões`);
      
      if (this.connectionCallback) {
        this.connectionCallback("connected");
      }
    } catch (error: any) {
      this.connectionStatus = "disconnected";
      logger.error(`[WebChatAdapter] Erro ao inicializar: ${error.message}`);
      throw new WhatsAppAdapterError(
        `Falha ao inicializar WebChat: ${error.message}`,
        "WEBCHAT_INIT_ERROR",
        error
      );
    }
  }
  
  /**
   * Configura o servidor Socket.IO
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }
  
  /**
   * Configura handlers do Socket.IO
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;
    
    const namespace = this.io.of(`/webchat/${this.config.widgetId}`);
    
    namespace.on("connection", (socket: Socket) => {
      logger.info(`[WebChatAdapter] Nova conexão: ${socket.id}`);
      
      // Gerar ID único para o visitante
      const sessionId = uuidv4();
      const recipientId = `webchat_${this.config.widgetId}_${sessionId}`;
      
      // Criar sessão
      const session: WebChatSession = {
        sessionId,
        recipientId,
        socket,
        startedAt: new Date(),
        lastActivity: new Date()
      };
      
      this.sessions.set(recipientId, session);
      
      // Enviar ID da sessão para o cliente
      socket.emit("session:start", {
        sessionId,
        recipientId,
        greeting: this.config.greeting
      });
      
      // Handler para identificação do visitante
      socket.on("visitor:identify", (data: { name?: string; email?: string }) => {
        session.contactName = data.name;
        session.contactEmail = data.email;
        session.lastActivity = new Date();
        
        logger.info(`[WebChatAdapter] Visitante identificado: ${data.name} (${data.email})`);
      });
      
      // Handler para mensagens recebidas
      socket.on("message:send", async (data: { text: string; attachments?: any[] }) => {
        session.lastActivity = new Date();
        
        const message: IWhatsAppMessage = {
          id: `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: recipientId,
          to: this.config.widgetId,
          body: data.text,
          timestamp: Date.now(),
          fromMe: false
        };
        
        // Processar anexos se houver
        if (data.attachments?.length > 0) {
          const attachment = data.attachments[0];
          message.mediaType = attachment.type;
          message.mediaUrl = attachment.url;
        }
        
        logger.info(`[WebChatAdapter] Mensagem recebida de ${recipientId}: ${data.text.substring(0, 50)}...`);
        
        // Chamar callback
        if (this.messageCallback) {
          this.messageCallback(message);
        }
        
        // Confirmar recebimento
        socket.emit("message:received", { messageId: message.id });
      });
      
      // Handler para digitação
      socket.on("typing:start", () => {
        session.lastActivity = new Date();
        // Pode emitir para o atendente
      });
      
      socket.on("typing:stop", () => {
        session.lastActivity = new Date();
      });
      
      // Handler para desconexão
      socket.on("disconnect", () => {
        logger.info(`[WebChatAdapter] Desconexão: ${socket.id}`);
        // Manter sessão por um tempo para reconexão
        setTimeout(() => {
          if (this.sessions.get(recipientId)?.socket.id === socket.id) {
            this.sessions.delete(recipientId);
          }
        }, 5 * 60 * 1000); // 5 minutos
      });
    });
  }
  
  /**
   * Desconecta o adapter
   */
  async disconnect(): Promise<void> {
    this.connectionStatus = "disconnected";
    this.sessions.clear();
    
    logger.info(`[WebChatAdapter] Desconectado whatsappId=${this.whatsappId}`);
    
    if (this.connectionCallback) {
      this.connectionCallback("disconnected");
    }
  }
  
  /**
   * Envia mensagem genérica
   */
  async sendMessage(options: ISendMessageOptions): Promise<IWhatsAppMessage> {
    const { to, body, mediaType, mediaUrl, caption } = options;
    
    try {
      if (mediaType && mediaType !== "text" && mediaUrl) {
        return this.sendMediaMessage(to, mediaUrl, mediaType, caption);
      }
      
      return this.sendTextMessage(to, body || "");
    } catch (error: any) {
      throw new WhatsAppAdapterError(
        `Erro ao enviar mensagem: ${error.message}`,
        "WEBCHAT_SEND_ERROR",
        error
      );
    }
  }
  
  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(to: string, body: string): Promise<IWhatsAppMessage> {
    try {
      const session = this.sessions.get(to);
      
      if (!session) {
        throw new Error(`Sessão não encontrada: ${to}`);
      }
      
      const messageId = `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Enviar via Socket.IO
      session.socket.emit("message:new", {
        id: messageId,
        text: body,
        fromMe: true,
        timestamp: Date.now()
      });
      
      logger.info(`[WebChatAdapter] Texto enviado para ${to}: ${body.substring(0, 50)}...`);
      
      return {
        id: messageId,
        from: this.config.widgetId,
        to,
        body,
        timestamp: Date.now(),
        fromMe: true,
        ack: 1
      };
    } catch (error: any) {
      logger.error(`[WebChatAdapter] Erro ao enviar texto: ${error.message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar texto: ${error.message}`, "WEBCHAT_TEXT_ERROR", error);
    }
  }
  
  /**
   * Envia mensagem com mídia
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<IWhatsAppMessage> {
    try {
      const session = this.sessions.get(to);
      
      if (!session) {
        throw new Error(`Sessão não encontrada: ${to}`);
      }
      
      const messageId = `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      session.socket.emit("message:new", {
        id: messageId,
        text: caption || "",
        mediaType,
        mediaUrl,
        fromMe: true,
        timestamp: Date.now()
      });
      
      logger.info(`[WebChatAdapter] Mídia enviada para ${to}: ${mediaType}`);
      
      return {
        id: messageId,
        from: this.config.widgetId,
        to,
        body: caption || mediaUrl,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: mediaType as any,
        mediaUrl,
        caption,
        ack: 1
      };
    } catch (error: any) {
      logger.error(`[WebChatAdapter] Erro ao enviar mídia: ${error.message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar mídia: ${error.message}`, "WEBCHAT_MEDIA_ERROR", error);
    }
  }
  
  /**
   * Envia documento
   */
  async sendDocumentMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<IWhatsAppMessage> {
    try {
      const session = this.sessions.get(to);
      
      if (!session) {
        throw new Error(`Sessão não encontrada: ${to}`);
      }
      
      // Salvar arquivo e obter URL
      const fileUrl = await this.uploadToTemp(fileBuffer, fileName, mimeType);
      
      const messageId = `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      session.socket.emit("message:new", {
        id: messageId,
        text: fileName,
        mediaType: "document",
        mediaUrl: fileUrl,
        fileName,
        mimeType,
        fromMe: true,
        timestamp: Date.now()
      });
      
      logger.info(`[WebChatAdapter] Documento enviado para ${to}: ${fileName}`);
      
      return {
        id: messageId,
        from: this.config.widgetId,
        to,
        body: fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "document",
        mediaUrl: fileUrl,
        ack: 1
      };
    } catch (error: any) {
      logger.error(`[WebChatAdapter] Erro ao enviar documento: ${error.message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar documento: ${error.message}`, "WEBCHAT_DOC_ERROR", error);
    }
  }
  
  /**
   * Upload temporário
   */
  private async uploadToTemp(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");
    
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public", "temp");
    
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    
    const tempFileName = `wc_${Date.now()}_${fileName}`;
    const tempPath = path.join(publicFolder, tempFileName);
    
    fs.writeFileSync(tempPath, buffer);
    
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    return `${backendUrl}/public/temp/${tempFileName}`;
  }
  
  /**
   * Obtém foto de perfil (não disponível no WebChat)
   */
  async getProfilePicture(userId: string): Promise<string | null> {
    return null;
  }
  
  /**
   * Obtém status
   */
  async getStatus(userId: string): Promise<string | null> {
    const session = this.sessions.get(userId);
    return session ? "online" : "offline";
  }
  
  /**
   * Obtém informações do perfil
   */
  async getProfileInfo(userId: string): Promise<IProfileInfo | null> {
    const session = this.sessions.get(userId);
    
    if (!session) return null;
    
    return {
      name: session.contactName || "Visitante",
      about: session.contactEmail
    };
  }
  
  /**
   * Retorna status da conexão
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  /**
   * Retorna ID do widget
   */
  getPhoneNumber(): string | null {
    return this.config.widgetId;
  }
  
  /**
   * Registra callback para mensagens recebidas
   */
  onMessage(callback: (message: IWhatsAppMessage) => void): void {
    this.messageCallback = callback;
  }
  
  /**
   * Registra callback para atualizações de conexão
   */
  onConnectionUpdate(callback: (status: ConnectionStatus) => void): void {
    this.connectionCallback = callback;
  }
  
  /**
   * Envia indicador de digitação
   */
  async sendPresenceUpdate(
    userId: string,
    type: "available" | "unavailable" | "composing" | "recording"
  ): Promise<void> {
    try {
      const session = this.sessions.get(userId);
      
      if (session) {
        session.socket.emit("agent:typing", {
          isTyping: type === "composing"
        });
      }
    } catch (error: any) {
      logger.warn(`[WebChatAdapter] Erro ao enviar presença: ${error.message}`);
    }
  }
  
  /**
   * Retorna configuração do widget
   */
  getWidgetConfig(): WebChatAdapterConfig {
    return this.config;
  }
  
  /**
   * Retorna sessões ativas
   */
  getActiveSessions(): number {
    return this.sessions.size;
  }
  
  /**
   * Obtém sessão por ID
   */
  getSession(recipientId: string): WebChatSession | undefined {
    return this.sessions.get(recipientId);
  }
}

export default WebChatAdapter;
