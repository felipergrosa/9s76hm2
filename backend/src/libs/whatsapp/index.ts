/**
 * Módulo de abstração para canais de mensageria
 * 
 * Suporta:
 * - WhatsApp Baileys (não oficial)
 * - WhatsApp Business API (oficial)
 * - Facebook Messenger
 * - Instagram Direct
 * - WebChat (widget embeddable)
 * 
 * @example
 * ```typescript
 * import { WhatsAppFactory } from './libs/whatsapp';
 * 
 * // Criar adapter automaticamente baseado no channelType
 * const adapter = await WhatsAppFactory.createAdapter(whatsapp);
 * 
 * // Inicializar
 * await adapter.initialize();
 * 
 * // Enviar mensagem (funciona para qualquer canal!)
 * const message = await adapter.sendTextMessage('5511999999999', 'Olá!');
 * ```
 */

// Interfaces
export {
  IWhatsAppAdapter,
  IWhatsAppMessage,
  ISendMessageOptions,
  IProfileInfo,
  IWhatsAppAdapterConfig,
  ConnectionStatus,
  WhatsAppAdapterError
} from "./IWhatsAppAdapter";

// Adapters - WhatsApp
export { BaileysAdapter } from "./BaileysAdapter";
export { OfficialAPIAdapter } from "./OfficialAPIAdapter";

// Adapters - Meta (Facebook/Instagram)
export { FacebookAdapter } from "./FacebookAdapter";
export { InstagramAdapter } from "./InstagramAdapter";

// Adapters - WebChat
export { WebChatAdapter } from "./WebChatAdapter";

// Factory
export { WhatsAppFactory } from "./WhatsAppFactory";
