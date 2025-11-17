/**
 * Módulo de abstração WhatsApp
 * Suporta Baileys (não oficial) e WhatsApp Business API (oficial)
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
 * // Enviar mensagem
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

// Adapters
export { BaileysAdapter } from "./BaileysAdapter";
export { OfficialAPIAdapter } from "./OfficialAPIAdapter";

// Factory
export { WhatsAppFactory } from "./WhatsAppFactory";
