/**
 * FacebookAdapter.ts
 * 
 * Adapter unificado para Facebook Messenger
 * Implementa IWhatsAppAdapter para integração com IA/RAG
 */

import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";

interface FacebookAdapterConfig {
  pageId: string;
  pageAccessToken: string;
  appId?: string;
  appSecret?: string;
}

export class FacebookAdapter implements IWhatsAppAdapter {
  readonly whatsappId: number;
  readonly channelType: "baileys" | "official" = "official"; // Usa mesma categoria
  
  private client: AxiosInstance;
  private config: FacebookAdapterConfig;
  private connectionStatus: ConnectionStatus = "disconnected";
  private messageCallback?: (message: IWhatsAppMessage) => void;
  private connectionCallback?: (status: ConnectionStatus) => void;
  
  // Identificador do canal
  readonly channel: "facebook" = "facebook";
  
  constructor(whatsappId: number, config: FacebookAdapterConfig) {
    this.whatsappId = whatsappId;
    this.config = config;
    
    this.client = axios.create({
      baseURL: "https://graph.facebook.com/v18.0/",
      params: {
        access_token: config.pageAccessToken
      },
      timeout: 30000
    });
    
    logger.info(`[FacebookAdapter] Criado para whatsappId=${whatsappId}, pageId=${config.pageId}`);
  }
  
  /**
   * Inicializa o adapter e verifica conexão
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[FacebookAdapter] Inicializando whatsappId=${this.whatsappId}`);
      
      // Verificar se o token é válido
      const response = await this.client.get("me", {
        params: {
          fields: "id,name"
        }
      });
      
      if (response.data.id) {
        this.connectionStatus = "connected";
        logger.info(`[FacebookAdapter] Conectado: ${response.data.name} (${response.data.id})`);
        
        if (this.connectionCallback) {
          this.connectionCallback("connected");
        }
      }
    } catch (error: any) {
      this.connectionStatus = "disconnected";
      logger.error(`[FacebookAdapter] Erro ao inicializar: ${error.message}`);
      throw new WhatsAppAdapterError(
        `Falha ao conectar Facebook: ${error.message}`,
        "FB_INIT_ERROR",
        error
      );
    }
  }
  
  /**
   * Desconecta o adapter
   */
  async disconnect(): Promise<void> {
    this.connectionStatus = "disconnected";
    logger.info(`[FacebookAdapter] Desconectado whatsappId=${this.whatsappId}`);
    
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
        "FB_SEND_ERROR",
        error
      );
    }
  }
  
  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(to: string, body: string): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[FacebookAdapter] Enviando texto para ${to}`);
      
      const response = await this.client.post("me/messages", {
        recipient: { id: to },
        message: { text: body }
      });
      
      const messageId = response.data.message_id || `fb_${Date.now()}`;
      
      logger.info(`[FacebookAdapter] Texto enviado: ${messageId}`);
      
      return {
        id: messageId,
        from: this.config.pageId,
        to,
        body,
        timestamp: Date.now(),
        fromMe: true,
        ack: 1
      };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[FacebookAdapter] Erro ao enviar texto: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar texto: ${message}`, "FB_TEXT_ERROR", error);
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
      logger.info(`[FacebookAdapter] Enviando mídia ${mediaType} para ${to}`);
      
      // Mapear tipo para Facebook
      const fbType = this.mapMediaType(mediaType);
      
      const response = await this.client.post("me/messages", {
        recipient: { id: to },
        message: {
          attachment: {
            type: fbType,
            payload: {
              url: mediaUrl,
              is_reusable: true
            }
          }
        }
      });
      
      const messageId = response.data.message_id || `fb_${Date.now()}`;
      
      logger.info(`[FacebookAdapter] Mídia enviada: ${messageId}`);
      
      return {
        id: messageId,
        from: this.config.pageId,
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
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[FacebookAdapter] Erro ao enviar mídia: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar mídia: ${message}`, "FB_MEDIA_ERROR", error);
    }
  }
  
  /**
   * Envia documento (PDF, etc) a partir de um Buffer
   */
  async sendDocumentMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[FacebookAdapter] Enviando documento ${fileName} para ${to}`);
      
      // Facebook não suporta upload direto de buffer
      // Precisamos fazer upload primeiro para obter URL
      // Por enquanto, vamos usar o método de URL se disponível
      
      // Alternativa: salvar temporariamente e usar URL do backend
      const tempUrl = await this.uploadToTemp(fileBuffer, fileName, mimeType);
      
      const response = await this.client.post("me/messages", {
        recipient: { id: to },
        message: {
          attachment: {
            type: "file",
            payload: {
              url: tempUrl,
              is_reusable: false
            }
          }
        }
      });
      
      const messageId = response.data.message_id || `fb_${Date.now()}`;
      
      logger.info(`[FacebookAdapter] Documento enviado: ${messageId}`);
      
      return {
        id: messageId,
        from: this.config.pageId,
        to,
        body: fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "document",
        ack: 1
      };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[FacebookAdapter] Erro ao enviar documento: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar documento: ${message}`, "FB_DOC_ERROR", error);
    }
  }
  
  /**
   * Upload temporário para obter URL pública
   */
  private async uploadToTemp(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    // Salvar arquivo temporariamente no public folder
    const fs = await import("fs");
    const path = await import("path");
    
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public", "temp");
    
    // Criar pasta se não existir
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    
    const tempFileName = `fb_${Date.now()}_${fileName}`;
    const tempPath = path.join(publicFolder, tempFileName);
    
    fs.writeFileSync(tempPath, buffer);
    
    // Retornar URL pública
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    return `${backendUrl}/public/temp/${tempFileName}`;
  }
  
  /**
   * Mapeia tipo de mídia para formato Facebook
   */
  private mapMediaType(type: string): string {
    const mapping: Record<string, string> = {
      image: "image",
      video: "video",
      audio: "audio",
      document: "file",
      ptt: "audio",
      sticker: "image"
    };
    return mapping[type] || "file";
  }
  
  /**
   * Obtém foto de perfil
   */
  async getProfilePicture(userId: string): Promise<string | null> {
    try {
      const response = await this.client.get(`${userId}/picture`, {
        params: {
          type: "large",
          redirect: false
        }
      });
      return response.data.data?.url || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Obtém status (não disponível no Facebook)
   */
  async getStatus(userId: string): Promise<string | null> {
    return null; // Facebook não tem status como WhatsApp
  }
  
  /**
   * Obtém informações do perfil
   */
  async getProfileInfo(userId: string): Promise<IProfileInfo | null> {
    try {
      const response = await this.client.get(userId, {
        params: {
          fields: "id,name,first_name,last_name,profile_pic"
        }
      });
      
      return {
        name: response.data.name || `${response.data.first_name} ${response.data.last_name}`,
        pictureUrl: response.data.profile_pic
      };
    } catch (error: any) {
      logger.warn(`[FacebookAdapter] Erro ao buscar perfil: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Retorna status da conexão
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  /**
   * Retorna ID da página
   */
  getPhoneNumber(): string | null {
    return this.config.pageId;
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
   * Processa mensagem recebida do webhook
   * Chamado pelo facebookMessageListener
   */
  processIncomingMessage(webhookData: any): IWhatsAppMessage | null {
    try {
      const messaging = webhookData.messaging?.[0];
      if (!messaging || !messaging.message) return null;
      
      const message: IWhatsAppMessage = {
        id: messaging.message.mid,
        from: messaging.sender.id,
        to: messaging.recipient.id,
        body: messaging.message.text || "",
        timestamp: messaging.timestamp * 1000,
        fromMe: false
      };
      
      // Verificar anexos
      if (messaging.message.attachments?.length > 0) {
        const attachment = messaging.message.attachments[0];
        message.mediaType = attachment.type as any;
        message.mediaUrl = attachment.payload?.url;
      }
      
      // Chamar callback se registrado
      if (this.messageCallback) {
        this.messageCallback(message);
      }
      
      return message;
    } catch (error: any) {
      logger.error(`[FacebookAdapter] Erro ao processar mensagem: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post("me/messages", {
        recipient: { id: messageId.split("_")[0] }, // Extrair userId do messageId
        sender_action: "mark_seen"
      });
    } catch (error: any) {
      logger.warn(`[FacebookAdapter] Erro ao marcar como lido: ${error.message}`);
    }
  }
  
  /**
   * Envia indicador de digitação
   */
  async sendPresenceUpdate(
    userId: string,
    type: "available" | "unavailable" | "composing" | "recording"
  ): Promise<void> {
    try {
      const action = type === "composing" ? "typing_on" : "typing_off";
      
      await this.client.post("me/messages", {
        recipient: { id: userId },
        sender_action: action
      });
    } catch (error: any) {
      logger.warn(`[FacebookAdapter] Erro ao enviar presença: ${error.message}`);
    }
  }
  
  /**
   * Retorna cliente Axios para uso avançado
   */
  getRawClient(): AxiosInstance {
    return this.client;
  }
}

export default FacebookAdapter;
