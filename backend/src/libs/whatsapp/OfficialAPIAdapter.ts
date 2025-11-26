import axios, { AxiosInstance, AxiosError } from "axios";
import {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";
import logger from "../../utils/logger";

/**
 * Configuração do adapter oficial
 */
interface OfficialAPIConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

/**
 * Adapter para WhatsApp Business API Oficial (Meta)
 * Usa a Graph API do Facebook
 */
export class OfficialAPIAdapter implements IWhatsAppAdapter {
  public readonly whatsappId: number;
  public readonly channelType: "official" = "official";
  
  private client: AxiosInstance;
  private phoneNumberId: string;
  private accessToken: string;
  private businessAccountId: string;
  private apiVersion: string;
  private status: ConnectionStatus = "disconnected";
  private phoneNumber: string | null = null;
  
  // Callbacks de eventos (webhooks processam externamente)
  private messageCallbacks: Array<(message: IWhatsAppMessage) => void> = [];
  private connectionCallbacks: Array<(status: ConnectionStatus) => void> = [];

  constructor(whatsappId: number, config: OfficialAPIConfig) {
    this.whatsappId = whatsappId;
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.businessAccountId = config.businessAccountId;
    this.apiVersion = config.apiVersion || "v18.0";

    const apiVersion = this.apiVersion;

    // Cliente HTTP para Graph API
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${apiVersion}`,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    // Interceptor para logs
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error(
          `[OfficialAPI] Erro HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data)}`
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Inicializa conexão (verifica credenciais)
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[OfficialAPI] Inicializando whatsappId=${this.whatsappId}`);
      
      // Verificar se credenciais são válidas e buscar dados do número
      const response = await this.client.get(`/${this.phoneNumberId}`);
      
      this.phoneNumber = response.data.display_phone_number;
      const verifiedName = response.data.verified_name;
      const qualityRating = response.data.quality_rating;
      
      this.status = "connected";
      
      logger.info(`[OfficialAPI] Inicializado com sucesso: ${this.phoneNumber}`);
      logger.info(`[OfficialAPI] Nome verificado: ${verifiedName}, Quality: ${qualityRating}`);
      
      // Buscar PIN 2FA do banco para registro automático
      let twoFactorPin: string | null = null;
      try {
        const Whatsapp = (await import("../../models/Whatsapp")).default;
        const whatsappRecord = await Whatsapp.findByPk(this.whatsappId);
        twoFactorPin = whatsappRecord?.wabaTwoFactorPin || null;
      } catch (fetchError: any) {
        logger.warn(`[OfficialAPI] Falha ao buscar PIN 2FA: ${fetchError.message}`);
      }
      
      // 1. Subscrever WABA ao app (para habilitar webhooks de produção)
      try {
        await this.client.post(`/${this.businessAccountId}/subscribed_apps`);
        logger.info(`[OfficialAPI] WABA subscrita ao app com sucesso`);
      } catch (subscribeError: any) {
        const errorMessage = subscribeError.response?.data?.error?.message || subscribeError.message;
        // Se já estiver subscrito, não é erro crítico
        if (subscribeError.response?.status === 400) {
          logger.warn(`[OfficialAPI] WABA já subscrita ao app: ${errorMessage}`);
        } else {
          logger.error(`[OfficialAPI] Erro ao subscrever WABA: ${errorMessage}`);
        }
      }
      
      // 2. Registrar número com PIN 2FA (para ativar envio/recebimento)
      if (twoFactorPin && twoFactorPin.length === 6) {
        try {
          await this.client.post(`/${this.phoneNumberId}/register`, {
            messaging_product: "whatsapp",
            pin: twoFactorPin
          });
          logger.info(`[OfficialAPI] Número registrado com PIN 2FA com sucesso`);
        } catch (registerError: any) {
          const errorMessage = registerError.response?.data?.error?.message || registerError.message;
          logger.error(`[OfficialAPI] Erro ao registrar número: ${errorMessage}`);
        }
      } else {
        logger.warn(`[OfficialAPI] PIN 2FA não configurado ou inválido. Configure um PIN de 6 dígitos para ativar o registro automático.`);
      }
      
      // Atualizar banco de dados com informações corretas
      try {
        const Whatsapp = (await import("../../models/Whatsapp")).default;
        await Whatsapp.update(
          {
            wabaPhoneNumberId: this.phoneNumberId,
            wabaBusinessAccountId: this.businessAccountId,
            status: "CONNECTED",
            number: this.phoneNumber
          },
          {
            where: { id: this.whatsappId }
          }
        );
        logger.info(`[OfficialAPI] Dados atualizados no banco: phoneNumberId=${this.phoneNumberId}`);
      } catch (dbError: any) {
        logger.warn(`[OfficialAPI] Falha ao atualizar banco: ${dbError.message}`);
      }
      
      // Notificar callbacks
      this.emitConnectionUpdate("connected");
      
    } catch (error: any) {
      this.status = "disconnected";
      const message = error.response?.data?.error?.message || error.message;
      
      logger.error(`[OfficialAPI] Erro ao inicializar: ${message}`);
      
      throw new WhatsAppAdapterError(
        `Falha ao inicializar WhatsApp Official API: ${message}`,
        error.response?.data?.error?.code || "INITIALIZATION_ERROR",
        error
      );
    }
  }

  /**
   * Desconecta (apenas marca status)
   */
  async disconnect(): Promise<void> {
    this.status = "disconnected";
    this.emitConnectionUpdate("disconnected");
    logger.info(`[OfficialAPI] Desconectado whatsappId=${this.whatsappId}`);
  }

  /**
   * Envia mensagem (método principal)
   */
  async sendMessage(options: ISendMessageOptions): Promise<IWhatsAppMessage> {
    try {
      const { to, body, mediaType, mediaUrl, caption, buttons, listSections, listTitle, listButtonText, vcard } = options;

      // Normalizar número (remover caracteres não numéricos)
      const recipient = to.replace(/\D/g, "");

      let payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient
      };

      // Mensagem de texto simples
      if (mediaType === "text" || !mediaType) {
        payload.type = "text";
        payload.text = { body: body || "" };
      }
      // Mensagem com botões interativos
      else if (buttons && buttons.length > 0) {
        payload.type = "interactive";
        payload.interactive = {
          type: "button",
          body: { text: body || "" },
          action: {
            buttons: buttons.slice(0, 3).map(btn => ({  // Max 3 botões
              type: "reply",
              reply: {
                id: btn.id,
                title: btn.title.substring(0, 20)  // Max 20 chars
              }
            }))
          }
        };
      }
      // Mensagem com lista interativa
      else if (listSections && listSections.length > 0) {
        payload.type = "interactive";
        payload.interactive = {
          type: "list",
          body: { text: body || "" },
          action: {
            button: listButtonText || "Ver opções",
            sections: listSections.slice(0, 10).map(section => ({  // Max 10 seções
              title: section.title.substring(0, 24),  // Max 24 chars
              rows: section.rows.slice(0, 10).map(row => ({  // Max 10 linhas por seção
                id: row.id,
                title: row.title.substring(0, 24),
                description: row.description?.substring(0, 72)  // Max 72 chars
              }))
            }))
          }
        };
        
        // Header opcional
        if (listTitle) {
          payload.interactive.header = {
            type: "text",
            text: listTitle.substring(0, 60)  // Max 60 chars
          };
        }
      }
      // vCard (contato)
      else if (vcard) {
        payload.type = "contacts";
        payload.contacts = [{ vcard }];
      }
      // Mensagem com mídia (imagem, vídeo, documento, áudio)
      else if (mediaUrl) {
        switch (mediaType) {
          case "image":
            payload.type = "image";
            payload.image = {
              link: mediaUrl,
              caption: caption?.substring(0, 1024)  // Max 1024 chars
            };
            break;
            
          case "video":
            payload.type = "video";
            payload.video = {
              link: mediaUrl,
              caption: caption?.substring(0, 1024)
            };
            break;
            
          case "audio":
          case "ptt":
            payload.type = "audio";
            payload.audio = {
              link: mediaUrl
            };
            break;
            
          case "document":
            payload.type = "document";
            payload.document = {
              link: mediaUrl,
              filename: caption || "documento.pdf"
            };
            break;
            
          default:
            throw new WhatsAppAdapterError(
              `Tipo de mídia não suportado: ${mediaType}`,
              "UNSUPPORTED_MEDIA_TYPE"
            );
        }
      }

      // Enviar mensagem
      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;

      logger.info(`[OfficialAPI] Mensagem enviada: ${messageId}`);

      // Retornar mensagem normalizada
      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: body || "",
        timestamp: Date.now(),
        fromMe: true,
        mediaType: mediaType as any,
        mediaUrl,
        caption,
        ack: 1  // Enviado
      };
      
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      const code = error.response?.data?.error?.code || "SEND_MESSAGE_ERROR";
      
      logger.error(`[OfficialAPI] Erro ao enviar mensagem: ${message}`);
      
      throw new WhatsAppAdapterError(
        `Falha ao enviar mensagem: ${message}`,
        code,
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
   * Deleta mensagem (suporte limitado - até 24h)
   * API Oficial só permite deletar mensagens próprias até 24h após envio
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${messageId}`;

      await this.client.delete(url);

      logger.info(`[OfficialAPIAdapter] Mensagem deletada: ${messageId}`);
    } catch (error: any) {
      logger.error(`[OfficialAPIAdapter] Erro ao deletar mensagem: ${error.response?.data || error.message}`);
      
      if (error.response?.status === 400 && error.response?.data?.error?.code === 100) {
        throw new WhatsAppAdapterError(
          "Não é possível deletar mensagens com mais de 24 horas",
          "MESSAGE_TOO_OLD",
          error
        );
      }
      
      throw new WhatsAppAdapterError(
        "Falha ao deletar mensagem",
        "DELETE_MESSAGE_ERROR",
        error
      );
    }
  }

  /**
   * Edita mensagem (API Oficial suporta edição até 15 minutos)
   */
  async editMessage(messageId: string, newBody: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        message_id: messageId,
        text: {
          body: newBody
        }
      };

      await this.client.post(url, payload);

      logger.info(`[OfficialAPIAdapter] Mensagem editada: ${messageId}`);
    } catch (error: any) {
      logger.error(`[OfficialAPIAdapter] Erro ao editar mensagem: ${error.response?.data || error.message}`);
      
      if (error.response?.status === 400 && error.response?.data?.error?.code === 131051) {
        throw new WhatsAppAdapterError(
          "Não é possível editar mensagens após 15 minutos",
          "MESSAGE_TOO_OLD",
          error
        );
      }
      
      throw new WhatsAppAdapterError(
        "Falha ao editar mensagem",
        "EDIT_MESSAGE_ERROR",
        error
      );
    }
  }

  /**
   * Envia template aprovado
   * Templates precisam ser criados e aprovados previamente no Meta Business Manager
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = "pt_BR",
    components?: any[]
  ): Promise<IWhatsAppMessage> {
    try {
      const recipient = to.replace(/\D/g, "");
      
      // IMPORTANTE:
      // O endpoint /message_templates retorna "components" com campos como
      // type/format/text/example/buttons, mas ESSE formato NÃO é o mesmo
      // esperado na chamada de envio de template.
      // Ao enviar, a Graph API espera "components" com "parameters" (type,text,image,...)
      // e não aceita a chave "format" dentro de template.components[x].
      // Como ainda não estamos montando parâmetros dinamicamente,
      // é mais seguro NÃO enviar components aqui e deixar o template usar
      // o conteúdo padrão aprovado no Business Manager.

      if (components && components.length) {
        logger.warn(
          `[OfficialAPI] sendTemplate recebeu components, mas eles serão ignorados por enquanto para evitar erro de formato. Template=${templateName}`
        );
      }

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;

      logger.info(`[OfficialAPI] Template enviado: ${messageId}`);

      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: `Template: ${templateName}`,
        timestamp: Date.now(),
        fromMe: true,
        ack: 1
      };
      
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      
      logger.error(`[OfficialAPI] Erro ao enviar template: ${message}`);
      
      throw new WhatsAppAdapterError(
        `Falha ao enviar template: ${message}`,
        error.response?.data?.error?.code || "SEND_TEMPLATE_ERROR",
        error
      );
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      });
      
      logger.debug(`[OfficialAPI] Mensagem marcada como lida: ${messageId}`);
    } catch (error: any) {
      logger.error(`[OfficialAPI] Erro ao marcar como lida: ${error.message}`);
    }
  }

  /**
   * Obtém foto de perfil (API oficial não tem endpoint público para isso)
   * Retorna null - usar cache de avatars do Baileys se disponível
   */
  async getProfilePicture(jid: string): Promise<string | null> {
    logger.debug(`[OfficialAPI] getProfilePicture não disponível na API oficial`);
    return null;
  }

  /**
   * Obtém status (API oficial não tem endpoint para isso)
   */
  async getStatus(jid: string): Promise<string | null> {
    logger.debug(`[OfficialAPI] getStatus não disponível na API oficial`);
    return null;
  }

  /**
   * Obtém informações do perfil (limitado na API oficial)
   */
  async getProfileInfo(jid: string): Promise<IProfileInfo | null> {
    return {
      name: jid.replace(/\D/g, ""),
      about: undefined,
      pictureUrl: undefined
    };
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
   * Nota: Mensagens chegam via webhooks, não por polling
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
   * Envia presença (não disponível na API oficial)
   */
  async sendPresenceUpdate(
    jid: string,
    type: "available" | "unavailable" | "composing" | "recording"
  ): Promise<void> {
    logger.debug(`[OfficialAPI] sendPresenceUpdate não disponível na API oficial`);
  }

  /**
   * Retorna cliente Axios (para uso avançado)
   */
  getRawClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Dispara callbacks de mensagem (chamado pelo webhook handler)
   */
  public emitMessage(message: IWhatsAppMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error: any) {
        logger.error(`[OfficialAPI] Erro em callback de mensagem: ${error.message}`);
      }
    });
  }

  /**
   * Dispara callbacks de conexão
   */
  public emitConnectionUpdate(status: ConnectionStatus): void {
    this.status = status;
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error: any) {
        logger.error(`[OfficialAPI] Erro em callback de conexão: ${error.message}`);
      }
    });
  }

  /**
   * Health check da API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get(`/${this.phoneNumberId}`);
      return true;
    } catch (error) {
      return false;
    }
  }
}
