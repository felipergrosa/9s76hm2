/**
 * InstagramAdapter.ts
 * 
 * Adapter unificado para Instagram Direct Messages
 * Implementa IWhatsAppAdapter para integração com IA/RAG
 * 
 * Instagram usa a mesma Graph API do Facebook, mas com endpoints específicos
 */

import axios, { AxiosInstance } from "axios";
import logger from "../../utils/logger";
import {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";

interface InstagramAdapterConfig {
  instagramAccountId: string;  // Instagram Business Account ID
  pageAccessToken: string;     // Token da página do Facebook vinculada
  pageId: string;              // ID da página do Facebook
}

export class InstagramAdapter implements IWhatsAppAdapter {
  readonly whatsappId: number;
  readonly channelType: "baileys" | "official" = "official";
  
  private client: AxiosInstance;
  private config: InstagramAdapterConfig;
  private connectionStatus: ConnectionStatus = "disconnected";
  private messageCallback?: (message: IWhatsAppMessage) => void;
  private connectionCallback?: (status: ConnectionStatus) => void;
  
  // Identificador do canal
  readonly channel: "instagram" = "instagram";
  
  constructor(whatsappId: number, config: InstagramAdapterConfig) {
    this.whatsappId = whatsappId;
    this.config = config;
    
    this.client = axios.create({
      baseURL: "https://graph.facebook.com/v18.0/",
      params: {
        access_token: config.pageAccessToken
      },
      timeout: 30000
    });
    
    logger.info(`[InstagramAdapter] Criado para whatsappId=${whatsappId}, igAccountId=${config.instagramAccountId}`);
  }
  
  /**
   * Inicializa o adapter e verifica conexão
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[InstagramAdapter] Inicializando whatsappId=${this.whatsappId}`);
      
      // Verificar se a conta Instagram está conectada
      const response = await this.client.get(this.config.instagramAccountId, {
        params: {
          fields: "id,username,name,profile_picture_url"
        }
      });
      
      if (response.data.id) {
        this.connectionStatus = "connected";
        logger.info(`[InstagramAdapter] Conectado: @${response.data.username} (${response.data.id})`);
        
        if (this.connectionCallback) {
          this.connectionCallback("connected");
        }
      }
    } catch (error: any) {
      this.connectionStatus = "disconnected";
      logger.error(`[InstagramAdapter] Erro ao inicializar: ${error.message}`);
      throw new WhatsAppAdapterError(
        `Falha ao conectar Instagram: ${error.message}`,
        "IG_INIT_ERROR",
        error
      );
    }
  }
  
  /**
   * Desconecta o adapter
   */
  async disconnect(): Promise<void> {
    this.connectionStatus = "disconnected";
    logger.info(`[InstagramAdapter] Desconectado whatsappId=${this.whatsappId}`);
    
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
        "IG_SEND_ERROR",
        error
      );
    }
  }
  
  /**
   * Envia mensagem de texto via Instagram DM
   */
  async sendTextMessage(to: string, body: string): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[InstagramAdapter] Enviando texto para ${to}`);
      
      // Instagram usa endpoint diferente para mensagens
      const response = await this.client.post(`${this.config.instagramAccountId}/messages`, {
        recipient: { id: to },
        message: { text: body }
      });
      
      const messageId = response.data.message_id || `ig_${Date.now()}`;
      
      logger.info(`[InstagramAdapter] Texto enviado: ${messageId}`);
      
      return {
        id: messageId,
        from: this.config.instagramAccountId,
        to,
        body,
        timestamp: Date.now(),
        fromMe: true,
        ack: 1
      };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[InstagramAdapter] Erro ao enviar texto: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar texto: ${message}`, "IG_TEXT_ERROR", error);
    }
  }
  
  /**
   * Envia mensagem com mídia
   * Instagram tem limitações: apenas imagens e vídeos em DM
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[InstagramAdapter] Enviando mídia ${mediaType} para ${to}`);
      
      // Instagram DM suporta apenas image e video
      const supportedTypes = ["image", "video"];
      const igType = supportedTypes.includes(mediaType) ? mediaType : "image";
      
      const response = await this.client.post(`${this.config.instagramAccountId}/messages`, {
        recipient: { id: to },
        message: {
          attachment: {
            type: igType,
            payload: {
              url: mediaUrl
            }
          }
        }
      });
      
      const messageId = response.data.message_id || `ig_${Date.now()}`;
      
      logger.info(`[InstagramAdapter] Mídia enviada: ${messageId}`);
      
      return {
        id: messageId,
        from: this.config.instagramAccountId,
        to,
        body: caption || mediaUrl,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: igType as any,
        mediaUrl,
        caption,
        ack: 1
      };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[InstagramAdapter] Erro ao enviar mídia: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar mídia: ${message}`, "IG_MEDIA_ERROR", error);
    }
  }
  
  /**
   * Envia documento
   * Instagram DM NÃO suporta documentos diretamente
   * Alternativa: enviar como link ou converter para imagem
   */
  async sendDocumentMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[InstagramAdapter] Tentando enviar documento ${fileName} para ${to}`);
      
      // Instagram não suporta documentos em DM
      // Vamos enviar uma mensagem com link para download
      const tempUrl = await this.uploadToTemp(fileBuffer, fileName, mimeType);
      
      const body = `📄 *${fileName}*\n\nClique para baixar: ${tempUrl}`;
      
      return this.sendTextMessage(to, body);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[InstagramAdapter] Erro ao enviar documento: ${message}`);
      throw new WhatsAppAdapterError(`Falha ao enviar documento: ${message}`, "IG_DOC_ERROR", error);
    }
  }
  
  /**
   * Upload temporário para obter URL pública
   */
  private async uploadToTemp(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");
    
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public", "temp");
    
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    
    const tempFileName = `ig_${Date.now()}_${fileName}`;
    const tempPath = path.join(publicFolder, tempFileName);
    
    fs.writeFileSync(tempPath, buffer);
    
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    return `${backendUrl}/public/temp/${tempFileName}`;
  }
  
  /**
   * Obtém foto de perfil do Instagram
   */
  async getProfilePicture(userId: string): Promise<string | null> {
    try {
      const response = await this.client.get(userId, {
        params: {
          fields: "profile_picture_url"
        }
      });
      return response.data.profile_picture_url || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Obtém status (não disponível no Instagram)
   */
  async getStatus(userId: string): Promise<string | null> {
    return null;
  }
  
  /**
   * Obtém informações do perfil
   */
  async getProfileInfo(userId: string): Promise<IProfileInfo | null> {
    try {
      const response = await this.client.get(userId, {
        params: {
          fields: "id,username,name,profile_picture_url"
        }
      });
      
      return {
        name: response.data.name || response.data.username,
        pictureUrl: response.data.profile_picture_url
      };
    } catch (error: any) {
      logger.warn(`[InstagramAdapter] Erro ao buscar perfil: ${error.message}`);
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
   * Retorna ID da conta Instagram
   */
  getPhoneNumber(): string | null {
    return this.config.instagramAccountId;
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
      
      if (this.messageCallback) {
        this.messageCallback(message);
      }
      
      return message;
    } catch (error: any) {
      logger.error(`[InstagramAdapter] Erro ao processar mensagem: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`${this.config.instagramAccountId}/messages`, {
        recipient: { id: messageId.split("_")[0] },
        sender_action: "mark_seen"
      });
    } catch (error: any) {
      logger.warn(`[InstagramAdapter] Erro ao marcar como lido: ${error.message}`);
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
      
      await this.client.post(`${this.config.instagramAccountId}/messages`, {
        recipient: { id: userId },
        sender_action: action
      });
    } catch (error: any) {
      logger.warn(`[InstagramAdapter] Erro ao enviar presença: ${error.message}`);
    }
  }
  
  /**
   * Retorna cliente Axios para uso avançado
   */
  getRawClient(): AxiosInstance {
    return this.client;
  }
}

export default InstagramAdapter;
