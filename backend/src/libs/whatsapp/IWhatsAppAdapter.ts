import { proto } from "@whiskeysockets/baileys";

/**
 * Interface unificada de mensagem (normalizada)
 * Funciona tanto para Baileys quanto para API Oficial
 */
export interface IWhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker" | "ptt" | "vcard";
  mediaUrl?: string;
  caption?: string;
  ack?: number;
  quotedMsg?: {
    id: string;
    body: string;
    from?: string;
  };
  vCards?: string[];
  isGroup?: boolean;
  participantJid?: string;
}

/**
 * Opções para envio de mensagem
 */
export interface ISendMessageOptions {
  to: string;
  body?: string;
  mediaType?: "text" | "image" | "video" | "audio" | "document" | "ptt";
  mediaUrl?: string;
  mediaPath?: string;
  caption?: string;
  quotedMsgId?: string;
  buttons?: Array<{
    id: string;
    title: string;
  }>;
  listTitle?: string;
  listButtonText?: string;
  listSections?: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  mentionedJidList?: string[];
  vcard?: string;
  filename?: string;
}

/**
 * Informações de perfil
 */
export interface IProfileInfo {
  name?: string;
  about?: string;
  pictureUrl?: string;
}

/**
 * Status da conexão
 */
export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "qrcode";

/**
 * Interface principal do adapter
 * Todos os adapters (Baileys, Official API) devem implementar esta interface
 */
export interface IWhatsAppAdapter {
  // Identificação
  readonly whatsappId: number;
  readonly channelType: "baileys" | "official";
  
  // Inicialização e controle
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Envio de mensagens
  sendMessage(options: ISendMessageOptions): Promise<IWhatsAppMessage>;
  sendTextMessage(to: string, body: string): Promise<IWhatsAppMessage>;
  sendMediaMessage(to: string, mediaUrl: string, mediaType: string, caption?: string): Promise<IWhatsAppMessage>;
  sendTemplate?(
    to: string,
    templateName: string,
    languageCode?: string,
    components?: any[]
  ): Promise<IWhatsAppMessage>;
  
  // Gestão de mensagens
  deleteMessage?(messageId: string): Promise<void>;
  editMessage?(messageId: string, newBody: string): Promise<void>;
  
  // Gestão de perfil e status
  getProfilePicture(jid: string): Promise<string | null>;
  getStatus(jid: string): Promise<string | null>;
  getProfileInfo(jid: string): Promise<IProfileInfo | null>;
  
  // Status da conexão
  getConnectionStatus(): ConnectionStatus;
  getPhoneNumber(): string | null;
  
  // Eventos (callbacks)
  onMessage(callback: (message: IWhatsAppMessage) => void): void;
  onConnectionUpdate(callback: (status: ConnectionStatus) => void): void;
  onQRCode?(callback: (qr: string) => void): void;  // Apenas para Baileys
  
  // Funcionalidades específicas (opcionais)
  markAsRead?(messageId: string): Promise<void>;
  sendPresenceUpdate?(jid: string, type: "available" | "unavailable" | "composing" | "recording"): Promise<void>;
  
  // Dados brutos (para compatibilidade)
  getRawClient?(): any;  // Retorna WASocket (Baileys) ou AxiosInstance (Official)
}

/**
 * Configuração para criar adapter
 */
export interface IWhatsAppAdapterConfig {
  whatsappId: number;
  channelType: "baileys" | "official";
  companyId: number;
  
  // Configurações Baileys
  baileys?: {
    name: string;
    allowGroup: boolean;
  };
  
  // Configurações API Oficial
  official?: {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId: string;
    webhookVerifyToken?: string;
  };
}

/**
 * Erro customizado do adapter
 */
export class WhatsAppAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = "WhatsAppAdapterError";
  }
}
