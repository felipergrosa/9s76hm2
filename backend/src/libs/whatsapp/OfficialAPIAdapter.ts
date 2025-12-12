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
import { safeNormalizePhoneNumber } from "../../utils/phone";

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

      // Normalizar número para formato canônico (DDI + nacional)
      const normalized = safeNormalizePhoneNumber(to);
      const recipient = normalized.canonical || String(to || "").replace(/\D/g, "");
      if (!recipient || recipient.length < 10) {
        throw new WhatsAppAdapterError(
          `Número de destinatário inválido: "${to}" (normalizado: "${recipient}")`,
          "INVALID_PHONE_NUMBER"
        );
      }

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
   * Envia documento (PDF, Excel, etc) a partir de um Buffer
   * Usado principalmente pelo ProcessOfficialBot para respostas da IA
   */
  async sendDocumentMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[OfficialAPI] Enviando documento via Media API: ${fileName}`);

      const FormData = require("form-data");
      const form = new FormData();

      form.append("messaging_product", "whatsapp");
      form.append("file", fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;

      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${this.accessToken}`
        },
        timeout: 60000
      });

      const mediaId = uploadResponse.data.id;

      logger.info(`[OfficialAPI] Upload de documento concluído. media_id=${mediaId}`);

      const recipient = to.replace(/\D/g, "");

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "document",
        document: {
          id: mediaId,
          filename: fileName
        }
      };

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;

      logger.info(`[OfficialAPI] Documento enviado com sucesso: ${messageId}`);

      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "document",
        ack: 1
      };

    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[OfficialAPI] Erro ao enviar documento: ${message}`);

      throw new WhatsAppAdapterError(
        `Falha ao enviar documento: ${message}`,
        error.response?.data?.error?.code || "SEND_DOCUMENT_ERROR",
        error
      );
    }
  }

  /**
   * Envia imagem a partir de um Buffer
   */
  async sendImageMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    caption?: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[OfficialAPI] Enviando imagem via Media API: ${fileName}`);

      const FormData = require("form-data");
      const form = new FormData();

      // Detectar mimetype pela extensão
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';

      form.append("messaging_product", "whatsapp");
      form.append("file", fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;

      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${this.accessToken}`
        },
        timeout: 60000
      });

      const mediaId = uploadResponse.data.id;
      logger.info(`[OfficialAPI] Upload de imagem concluído. media_id=${mediaId}`);

      const recipient = to.replace(/\D/g, "");

      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "image",
        image: {
          id: mediaId
        }
      };

      if (caption) {
        payload.image.caption = caption;
      }

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;
      logger.info(`[OfficialAPI] Imagem enviada com sucesso: ${messageId}`);

      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: caption || fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "image",
        ack: 1
      };

    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[OfficialAPI] Erro ao enviar imagem: ${message}`);
      throw new WhatsAppAdapterError(
        `Falha ao enviar imagem: ${message}`,
        error.response?.data?.error?.code || "SEND_IMAGE_ERROR",
        error
      );
    }
  }

  /**
   * Envia vídeo a partir de um Buffer
   */
  async sendVideoMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string,
    caption?: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[OfficialAPI] Enviando vídeo via Media API: ${fileName}`);

      const FormData = require("form-data");
      const form = new FormData();

      // Detectar mimetype pela extensão
      const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
      const mimeTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'avi': 'video/avi',
        'mov': 'video/quicktime',
        'mkv': 'video/x-matroska',
        '3gp': 'video/3gpp'
      };
      const mimeType = mimeTypes[ext] || 'video/mp4';

      form.append("messaging_product", "whatsapp");
      form.append("file", fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;

      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${this.accessToken}`
        },
        timeout: 120000 // Vídeos podem ser maiores
      });

      const mediaId = uploadResponse.data.id;
      logger.info(`[OfficialAPI] Upload de vídeo concluído. media_id=${mediaId}`);

      const recipient = to.replace(/\D/g, "");

      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "video",
        video: {
          id: mediaId
        }
      };

      if (caption) {
        payload.video.caption = caption;
      }

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;
      logger.info(`[OfficialAPI] Vídeo enviado com sucesso: ${messageId}`);

      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: caption || fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "video",
        ack: 1
      };

    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[OfficialAPI] Erro ao enviar vídeo: ${message}`);
      throw new WhatsAppAdapterError(
        `Falha ao enviar vídeo: ${message}`,
        error.response?.data?.error?.code || "SEND_VIDEO_ERROR",
        error
      );
    }
  }

  /**
   * Envia áudio a partir de um Buffer
   */
  async sendAudioMessage(
    to: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<IWhatsAppMessage> {
    try {
      logger.info(`[OfficialAPI] Enviando áudio via Media API: ${fileName}`);

      const FormData = require("form-data");
      const form = new FormData();

      // Detectar mimetype pela extensão
      const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac'
      };
      const mimeType = mimeTypes[ext] || 'audio/mpeg';

      form.append("messaging_product", "whatsapp");
      form.append("file", fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;

      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${this.accessToken}`
        },
        timeout: 60000
      });

      const mediaId = uploadResponse.data.id;
      logger.info(`[OfficialAPI] Upload de áudio concluído. media_id=${mediaId}`);

      const recipient = to.replace(/\D/g, "");

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "audio",
        audio: {
          id: mediaId
        }
      };

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      const messageId = response.data.messages[0].id;
      logger.info(`[OfficialAPI] Áudio enviado com sucesso: ${messageId}`);

      return {
        id: messageId,
        from: this.phoneNumber!,
        to: recipient,
        body: fileName,
        timestamp: Date.now(),
        fromMe: true,
        mediaType: "audio",
        ack: 1
      };

    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[OfficialAPI] Erro ao enviar áudio: ${message}`);
      throw new WhatsAppAdapterError(
        `Falha ao enviar áudio: ${message}`,
        error.response?.data?.error?.code || "SEND_AUDIO_ERROR",
        error
      );
    }
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
      const normalized = safeNormalizePhoneNumber(to);
      const recipient = normalized.canonical || String(to || "").replace(/\D/g, "");
      if (!recipient || recipient.length < 10) {
        throw new WhatsAppAdapterError(
          `Número de destinatário inválido: "${to}" (normalizado: "${recipient}")`,
          "INVALID_PHONE_NUMBER"
        );
      }

      const payload: any = {
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

      // NOVO: Processar components para detectar headers com mídia que precisam de upload
      let processedComponents = components;
      if (components && components.length > 0) {
        processedComponents = await this.processTemplateComponents(components);
      }

      // Adicionar components se fornecidos E se tiverem conteúdo
      if (processedComponents && processedComponents.length > 0) {
        // Validar que pelo menos um component tem parameters
        const hasParams = processedComponents.some(c => c.parameters?.length > 0);
        if (hasParams) {
          payload.template.components = processedComponents;
          logger.info(
            `[OfficialAPI] Enviando template ${templateName} com ${processedComponents.length} component(s) e parâmetros`
          );
        } else {
          logger.debug(
            `[OfficialAPI] Components fornecidos mas sem parâmetros, enviando template sem components`
          );
        }
      }

      console.log("[OfficialAPI] Payload final:", JSON.stringify(payload, null, 2));
      console.log("[OfficialAPI] Components enviados:", JSON.stringify(components, null, 2));
      console.log("[OfficialAPI] Template name:", templateName, "| Language:", languageCode);

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
   * Processa components de template para detectar e fazer upload de mídia em headers
   * Converte links de mídia em media_ids automaticamente
   */
  private async processTemplateComponents(components: any[]): Promise<any[]> {
    const processed = [];

    for (const component of components) {
      // Se não é header ou não tem parameters, passa direto
      if (component.type !== "header" || !component.parameters || component.parameters.length === 0) {
        processed.push(component);
        continue;
      }

      // Verificar se algum parameter do header tem mídia com link
      const processedParams = [];
      for (const param of component.parameters) {
        // Se parameter tem document/image/video com LINK (não ID), fazer upload
        const mediaType = param.type as string;
        if (["document", "image", "video"].includes(mediaType)) {
          const mediaObj = param[mediaType];

          // Se tem link ao invés de id, fazer upload
          if (mediaObj?.link && !mediaObj?.id) {
            logger.info(`[OfficialAPI] Detectado header ${mediaType} com link, fazendo upload...`);

            try {
              const mediaId = await this.uploadMedia(
                mediaObj.link,
                mediaType as "document" | "image" | "video"
              );

              // Substituir link por id
              processedParams.push({
                type: mediaType,
                [mediaType]: {
                  id: mediaId
                }
              });

              logger.info(`[OfficialAPI] Header ${mediaType} convertido para media_id: ${mediaId}`);
            } catch (err: any) {
              logger.error(`[OfficialAPI] Erro ao fazer upload de ${mediaType}: ${err.message}`);
              // Re-throw para não enviar template com mídia quebrada
              throw err;
            }
          } else {
            // Já tem ID ou estrutura diferente, passa direto
            processedParams.push(param);
          }
        } else {
          // Não é mídia, passa direto
          processedParams.push(param);
        }
      }

      processed.push({
        ...component,
        parameters: processedParams
      });
    }

    return processed;
  }

  /**
   * Faz upload de mídia para Meta e retorna media_id
   * Usado para templates com headers DOCUMENT/IMAGE/VIDEO
   */
  async uploadMedia(mediaUrl: string, mediaType: "document" | "image" | "video"): Promise<string> {
    try {
      logger.info(`[OfficialAPI] Fazendo upload de ${mediaType} via Media API`);

      // 1. Baixar o arquivo do link
      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        timeout: 60000, // 60s para download
        headers: {
          "User-Agent": "WhatsApp-Adapter/1.0"
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers["content-type"] || this.getContentType(mediaType);

      logger.debug(`[OfficialAPI] Arquivo baixado: ${buffer.length} bytes, tipo: ${contentType}`);

      // 2. Criar FormData para upload
      const FormData = require("form-data");
      const form = new FormData();

      // Nome do arquivo baseado no tipo
      const filename = this.getFilename(mediaType, contentType);

      form.append("messaging_product", "whatsapp");
      form.append("file", buffer, {
        filename,
        contentType
      });

      // 3. Upload via Media API
      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;

      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${this.accessToken}`
        },
        timeout: 60000
      });

      const mediaId = uploadResponse.data.id;

      logger.info(`[OfficialAPI] Upload concluído com sucesso. media_id: ${mediaId}`);

      return mediaId;

    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[OfficialAPI] Erro ao fazer upload de mídia: ${message}`);

      throw new WhatsAppAdapterError(
        `Falha ao fazer upload de mídia: ${message}`,
        error.response?.data?.error?.code || "MEDIA_UPLOAD_ERROR",
        error
      );
    }
  }

  /**
   * Retorna Content-Type baseado no tipo de mídia
   */
  private getContentType(mediaType: "document" | "image" | "video"): string {
    switch (mediaType) {
      case "document":
        return "application/pdf";
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Gera nome de arquivo baseado no tipo
   */
  private getFilename(mediaType: "document" | "image" | "video", contentType: string): string {
    const timestamp = Date.now();

    if (mediaType === "document") {
      return contentType.includes("pdf") ? `document_${timestamp}.pdf` : `document_${timestamp}.doc`;
    } else if (mediaType === "image") {
      return contentType.includes("png") ? `image_${timestamp}.png` : `image_${timestamp}.jpg`;
    } else if (mediaType === "video") {
      return `video_${timestamp}.mp4`;
    }

    return `file_${timestamp}`;
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
