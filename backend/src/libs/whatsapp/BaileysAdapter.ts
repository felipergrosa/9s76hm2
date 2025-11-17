import makeWASocket, {
  WASocket,
  DisconnectReason,
  WAMessage,
  proto,
  downloadMediaMessage,
  isJidGroup
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";
import { getWbot } from "../wbot";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";

/**
 * Adapter para Baileys (conexão não oficial)
 * Encapsula toda a lógica do Baileys seguindo a interface unificada
 */
export class BaileysAdapter implements IWhatsAppAdapter {
  public readonly whatsappId: number;
  public readonly channelType: "baileys" = "baileys";
  
  private socket: WASocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private phoneNumber: string | null = null;
  
  // Callbacks de eventos
  private messageCallbacks: Array<(message: IWhatsAppMessage) => void> = [];
  private connectionCallbacks: Array<(status: ConnectionStatus) => void> = [];
  private qrCallbacks: Array<(qr: string) => void> = [];

  constructor(whatsappId: number) {
    this.whatsappId = whatsappId;
  }

  /**
   * Inicializa conexão Baileys
   * Usa o código existente do initWASocket
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[BaileysAdapter] Inicializando para whatsappId=${this.whatsappId}`);
      
      // Usa o socket já inicializado pelo sistema existente
      this.socket = getWbot(this.whatsappId);
      
      if (!this.socket) {
        throw new WhatsAppAdapterError(
          "Socket Baileys não inicializado",
          "SOCKET_NOT_INITIALIZED"
        );
      }

      // Extrair número de telefone
      if (this.socket.user?.id) {
        this.phoneNumber = this.socket.user.id.split("@")[0];
      }

      this.status = "connected";
      logger.info(`[BaileysAdapter] Inicializado com sucesso: ${this.phoneNumber}`);
      
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao inicializar: ${error.message}`);
      this.status = "disconnected";
      throw new WhatsAppAdapterError(
        "Falha ao inicializar Baileys",
        "INITIALIZATION_ERROR",
        error
      );
    }
  }

  /**
   * Desconecta sessão Baileys
   */
  async disconnect(): Promise<void> {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket.ws.close();
        this.socket = null;
      }
      this.status = "disconnected";
      logger.info(`[BaileysAdapter] Desconectado whatsappId=${this.whatsappId}`);
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao desconectar: ${error.message}`);
      throw new WhatsAppAdapterError(
        "Falha ao desconectar",
        "DISCONNECT_ERROR",
        error
      );
    }
  }

  /**
   * Envia mensagem (método principal)
   */
  async sendMessage(options: ISendMessageOptions): Promise<IWhatsAppMessage> {
    if (!this.socket) {
      throw new WhatsAppAdapterError(
        "Socket não conectado",
        "NOT_CONNECTED"
      );
    }

    try {
      const { to, body, mediaType, mediaPath, mediaUrl, caption, quotedMsgId, buttons, listSections, vcard } = options;
      
      let content: any;
      let sentMsg: any;

      // Mensagem de texto simples
      if (mediaType === "text" || !mediaType) {
        content = { text: body || "" };
        
        // Adicionar quoted se existir
        if (quotedMsgId) {
          content.quoted = { key: { id: quotedMsgId } };
        }
        
        sentMsg = await this.socket.sendMessage(to, content);
      }
      // Mensagem com botões
      else if (buttons && buttons.length > 0) {
        content = {
          text: body || "",
          buttons: buttons.map(btn => ({
            buttonId: btn.id,
            buttonText: { displayText: btn.title },
            type: 1
          })),
          headerType: 1
        };
        sentMsg = await this.socket.sendMessage(to, content);
      }
      // Mensagem com lista
      else if (listSections && listSections.length > 0) {
        content = {
          text: body || "",
          sections: listSections.map(section => ({
            title: section.title,
            rows: section.rows.map(row => ({
              rowId: row.id,
              title: row.title,
              description: row.description
            }))
          })),
          buttonText: options.listButtonText || "Ver opções",
          title: options.listTitle || "",
          footer: ""
        };
        sentMsg = await this.socket.sendMessage(to, content as any);
      }
      // vCard (contato)
      else if (vcard) {
        content = {
          contacts: {
            displayName: "Contato",
            contacts: [{ vcard }]
          }
        };
        sentMsg = await this.socket.sendMessage(to, content);
      }
      // Mensagem com mídia
      else if (mediaPath || mediaUrl) {
        const mediaData = mediaPath
          ? { url: mediaPath }
          : { url: mediaUrl };

        switch (mediaType) {
          case "image":
            content = {
              image: mediaData,
              caption: caption || ""
            };
            break;
          case "video":
            content = {
              video: mediaData,
              caption: caption || ""
            };
            break;
          case "audio":
          case "ptt":
            content = {
              audio: mediaData,
              mimetype: "audio/mp4",
              ptt: mediaType === "ptt"
            };
            break;
          case "document":
            content = {
              document: mediaData,
              mimetype: "application/pdf",
              fileName: caption || "documento.pdf"
            };
            break;
          default:
            throw new WhatsAppAdapterError(
              `Tipo de mídia não suportado: ${mediaType}`,
              "UNSUPPORTED_MEDIA_TYPE"
            );
        }

        sentMsg = await this.socket.sendMessage(to, content);
      }

      // Converter para formato normalizado
      return this.convertBaileysToNormalized(sentMsg);
      
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao enviar mensagem: ${error.message}`);
      throw new WhatsAppAdapterError(
        "Falha ao enviar mensagem",
        "SEND_MESSAGE_ERROR",
        error
      );
    }
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendTextMessage(to: string, body: string): Promise<IWhatsAppMessage> {
    return this.sendMessage({ to, body, mediaType: "text" });
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
    return this.sendMessage({
      to,
      mediaUrl,
      mediaType: mediaType as any,
      caption
    });
  }

  /**
   * Obtém foto de perfil
   */
  async getProfilePicture(jid: string): Promise<string | null> {
    if (!this.socket) return null;
    
    try {
      const url = await this.socket.profilePictureUrl(jid, "image");
      return url;
    } catch (error) {
      logger.debug(`[BaileysAdapter] Foto de perfil não encontrada para ${jid}`);
      return null;
    }
  }

  /**
   * Obtém status/about
   */
  async getStatus(jid: string): Promise<string | null> {
    if (!this.socket) return null;
    
    try {
      const status: any = await this.socket.fetchStatus(jid);
      return status?.status || status || null;
    } catch (error) {
      logger.debug(`[BaileysAdapter] Status não encontrado para ${jid}`);
      return null;
    }
  }

  /**
   * Obtém informações completas do perfil
   */
  async getProfileInfo(jid: string): Promise<IProfileInfo | null> {
    if (!this.socket) return null;
    
    try {
      const [pictureUrl, status] = await Promise.all([
        this.getProfilePicture(jid),
        this.getStatus(jid)
      ]);

      return {
        name: jid.split("@")[0], // Baileys não retorna nome facilmente
        about: status,
        pictureUrl: pictureUrl || undefined
      };
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao obter info do perfil: ${error.message}`);
      return null;
    }
  }

  /**
   * Retorna status da conexão
   */
  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Retorna número de telefone
   */
  getPhoneNumber(): string | null {
    return this.phoneNumber;
  }

  /**
   * Registra callback para mensagens recebidas
   */
  onMessage(callback: (message: IWhatsAppMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Registra callback para mudanças de conexão
   */
  onConnectionUpdate(callback: (status: ConnectionStatus) => void): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Registra callback para QR Code
   */
  onQRCode(callback: (qr: string) => void): void {
    this.qrCallbacks.push(callback);
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!this.socket) return;
    
    try {
      await this.socket.readMessages([{ id: messageId } as any]);
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao marcar como lida: ${error.message}`);
    }
  }

  /**
   * Envia presença (digitando, gravando áudio, etc)
   */
  async sendPresenceUpdate(
    jid: string,
    type: "available" | "unavailable" | "composing" | "recording"
  ): Promise<void> {
    if (!this.socket) return;
    
    try {
      await this.socket.sendPresenceUpdate(type, jid);
    } catch (error) {
      logger.error(`[BaileysAdapter] Erro ao enviar presença: ${error.message}`);
    }
  }

  /**
   * Retorna socket Baileys bruto (para compatibilidade)
   */
  getRawClient(): WASocket | null {
    return this.socket;
  }

  /**
   * Converte mensagem Baileys para formato normalizado
   */
  private convertBaileysToNormalized(msg: proto.IWebMessageInfo): IWhatsAppMessage {
    const body = this.extractBodyFromMessage(msg);
    const mediaType = this.extractMediaType(msg);
    
    return {
      id: msg.key.id!,
      from: msg.key.remoteJid!,
      to: msg.key.remoteJid!,
      body,
      timestamp: Number(msg.messageTimestamp),
      fromMe: msg.key.fromMe || false,
      mediaType,
      ack: msg.status,
      isGroup: isJidGroup(msg.key.remoteJid!),
      participantJid: msg.participant
    };
  }

  /**
   * Extrai corpo da mensagem Baileys
   */
  private extractBodyFromMessage(msg: proto.IWebMessageInfo): string {
    const message = msg.message;
    if (!message) return "";

    return (
      message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      message.documentMessage?.caption ||
      ""
    );
  }

  /**
   * Extrai tipo de mídia da mensagem
   */
  private extractMediaType(msg: proto.IWebMessageInfo): IWhatsAppMessage["mediaType"] {
    const message = msg.message;
    if (!message) return undefined;

    if (message.imageMessage) return "image";
    if (message.videoMessage) return "video";
    if (message.audioMessage) return message.audioMessage.ptt ? "ptt" : "audio";
    if (message.documentMessage) return "document";
    if (message.stickerMessage) return "sticker";
    if (message.contactMessage || message.contactsArrayMessage) return "vcard";

    return undefined;
  }

  /**
   * Dispara callbacks de mensagem (chamado pelo listener)
   */
  public emitMessage(message: IWhatsAppMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        logger.error(`[BaileysAdapter] Erro em callback de mensagem: ${error.message}`);
      }
    });
  }

  /**
   * Dispara callbacks de conexão (chamado pelo listener)
   */
  public emitConnectionUpdate(status: ConnectionStatus): void {
    this.status = status;
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        logger.error(`[BaileysAdapter] Erro em callback de conexão: ${error.message}`);
      }
    });
  }

  /**
   * Dispara callbacks de QR Code (chamado pelo listener)
   */
  public emitQRCode(qr: string): void {
    this.qrCallbacks.forEach(callback => {
      try {
        callback(qr);
      } catch (error) {
        logger.error(`[BaileysAdapter] Erro em callback de QR: ${error.message}`);
      }
    });
  }
}
