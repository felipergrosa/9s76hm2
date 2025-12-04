import Whatsapp from "../../models/Whatsapp";
import { IWhatsAppAdapter } from "./IWhatsAppAdapter";
import { BaileysAdapter } from "./BaileysAdapter";
import { OfficialAPIAdapter } from "./OfficialAPIAdapter";
import { FacebookAdapter } from "./FacebookAdapter";
import { InstagramAdapter } from "./InstagramAdapter";
import { WebChatAdapter } from "./WebChatAdapter";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

/**
 * Factory para criar adapters de mensageria
 * Suporta: WhatsApp (Baileys/Official), Facebook, Instagram, WebChat
 */
export class WhatsAppFactory {
  // Cache de adapters ativos (evita recriar)
  private static adapters = new Map<number, IWhatsAppAdapter>();

  /**
   * Cria ou retorna adapter existente
   */
  static async createAdapter(whatsapp: Whatsapp): Promise<IWhatsAppAdapter> {
    const whatsappId = whatsapp.id;
    const channelType = whatsapp.channelType || whatsapp.channel || "baileys";

    // Verificar se já existe adapter ativo
    const existingAdapter = this.adapters.get(whatsappId);
    if (existingAdapter) {
      logger.debug(`[WhatsAppFactory] Retornando adapter existente: ${whatsappId}`);
      return existingAdapter;
    }

    // Criar novo adapter
    let adapter: IWhatsAppAdapter;

    switch (channelType) {
      case "baileys":
        logger.info(`[WhatsAppFactory] Criando BaileysAdapter para whatsappId=${whatsappId}`);
        adapter = new BaileysAdapter(whatsappId);
        break;

      case "official":
        logger.info(`[WhatsAppFactory] Criando OfficialAPIAdapter para whatsappId=${whatsappId}`);
        
        // Validar credenciais
        if (!whatsapp.wabaPhoneNumberId || !whatsapp.wabaAccessToken) {
          throw new AppError(
            "Credenciais WhatsApp Official API não configuradas. Configure phoneNumberId e accessToken.",
            400
          );
        }

        if (!whatsapp.wabaBusinessAccountId) {
          logger.warn(`[WhatsAppFactory] businessAccountId não configurado para whatsappId=${whatsappId}`);
        }

        adapter = new OfficialAPIAdapter(whatsappId, {
          phoneNumberId: whatsapp.wabaPhoneNumberId,
          accessToken: whatsapp.wabaAccessToken,
          businessAccountId: whatsapp.wabaBusinessAccountId || "",
          webhookVerifyToken: whatsapp.wabaWebhookVerifyToken
        });
        break;

      case "facebook":
        logger.info(`[WhatsAppFactory] Criando FacebookAdapter para whatsappId=${whatsappId}`);
        
        if (!whatsapp.facebookPageUserId || !whatsapp.facebookUserToken) {
          throw new AppError(
            "Credenciais Facebook não configuradas. Configure pageId e accessToken.",
            400
          );
        }

        adapter = new FacebookAdapter(whatsappId, {
          pageId: whatsapp.facebookPageUserId,
          pageAccessToken: whatsapp.facebookUserToken
        }) as any;
        break;

      case "instagram":
        logger.info(`[WhatsAppFactory] Criando InstagramAdapter para whatsappId=${whatsappId}`);
        
        // Instagram usa facebookPageUserId como instagramAccountId (vinculado via Graph API)
        if (!whatsapp.facebookPageUserId || !whatsapp.facebookUserToken) {
          throw new AppError(
            "Credenciais Instagram não configuradas. Configure a página do Facebook vinculada.",
            400
          );
        }

        adapter = new InstagramAdapter(whatsappId, {
          instagramAccountId: whatsapp.facebookPageUserId, // Instagram Business Account vinculado
          pageAccessToken: whatsapp.facebookUserToken,
          pageId: whatsapp.facebookPageUserId
        }) as any;
        break;

      case "webchat":
        logger.info(`[WhatsAppFactory] Criando WebChatAdapter para whatsappId=${whatsappId}`);
        
        adapter = new WebChatAdapter(whatsappId, {
          widgetId: whatsapp.name || `widget_${whatsappId}`,
          companyId: whatsapp.companyId,
          greeting: whatsapp.greetingMessage || "Olá! Como posso ajudar?"
        }) as any;
        break;

      default:
        throw new AppError(
          `Tipo de canal não suportado: ${channelType}. Use "baileys", "official", "facebook", "instagram" ou "webchat".`,
          400
        );
    }

    // Armazenar no cache
    this.adapters.set(whatsappId, adapter);

    return adapter;
  }

  /**
   * Remove adapter do cache (ao desconectar)
   */
  static removeAdapter(whatsappId: number): void {
    const adapter = this.adapters.get(whatsappId);
    if (adapter) {
      logger.info(`[WhatsAppFactory] Removendo adapter do cache: ${whatsappId}`);
      this.adapters.delete(whatsappId);
    }
  }

  /**
   * Retorna adapter se existir no cache
   */
  static getAdapter(whatsappId: number): IWhatsAppAdapter | undefined {
    return this.adapters.get(whatsappId);
  }

  /**
   * Verifica se adapter está ativo
   */
  static hasAdapter(whatsappId: number): boolean {
    return this.adapters.has(whatsappId);
  }

  /**
   * Lista todos os adapters ativos
   */
  static getActiveAdapters(): Map<number, IWhatsAppAdapter> {
    return this.adapters;
  }

  /**
   * Limpa todos os adapters
   */
  static clearAll(): void {
    logger.info(`[WhatsAppFactory] Limpando todos os adapters (${this.adapters.size})`);
    this.adapters.clear();
  }

  /**
   * Estatísticas dos adapters
   */
  static getStats(): {
    total: number;
    baileys: number;
    official: number;
    connected: number;
  } {
    let baileys = 0;
    let official = 0;
    let connected = 0;

    this.adapters.forEach(adapter => {
      if (adapter.channelType === "baileys") baileys++;
      if (adapter.channelType === "official") official++;
      if (adapter.getConnectionStatus() === "connected") connected++;
    });

    return {
      total: this.adapters.size,
      baileys,
      official,
      connected
    };
  }
}
