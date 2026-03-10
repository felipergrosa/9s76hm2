/**
 * Turbo Connector - Exports
 * 
 * Sistema multi-engine de WhatsApp com fallback automático
 */

export * from "./ITurboEngine";
export { EngineOrchestrator } from "./EngineOrchestrator";
export { BaileysAdapter } from "./BaileysAdapter";
export { WebJSAdapter } from "./WebJSAdapter";
export { TurboFactory } from "./TurboFactory";
export { TurboWrapper, createTurboWrapper } from "./TurboWrapper";
