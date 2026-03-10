/**
 * Interface unificada para engines de WhatsApp
 * 
 * Permite múltiplas implementações (Baileys, whatsapp-web.js, Venom, etc)
 * com fallback automático e feature routing.
 */

import { WASocket, WAMessage, Contact as WAContact, GroupMetadata } from "@whiskeysockets/baileys";

// ============================================================================
// TIPOS BASE
// ============================================================================

export type EngineType = "baileys" | "webjs" | "venom" | "gows";

export type EngineStatus = 
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "unhealthy";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface EngineCapabilities {
  // Mensagens
  sendText: boolean;
  sendMedia: boolean;
  sendDocument: boolean;
  sendReaction: boolean;
  sendLocation: boolean;
  sendContact: boolean;
  
  // Grupos
  createGroup: boolean;
  addParticipant: boolean;
  removeParticipant: boolean;
  promoteParticipant: boolean;
  demoteParticipant: boolean;
  getGroupMetadata: boolean;
  setGroupSubject: boolean;
  setGroupDescription: boolean;
  
  // Histórico
  fetchHistory: boolean;
  fetchHistoryReliable: boolean; // true = não bugado
  
  // Contatos
  getProfilePicture: boolean;
  getContact: boolean;
  resolveLid: boolean;
  resolveLidReliable: boolean; // true = mais estável
  
  // Features avançadas
  labels: boolean;
  stars: boolean;
  typingSimulation: boolean;
  businessFeatures: boolean;
  
  // Calls
  voiceCall: boolean;
  videoCall: boolean;
  screenShare: boolean;
}

export interface EngineInfo {
  type: EngineType;
  name: string;
  version: string;
  description: string;
  capabilities: EngineCapabilities;
  memoryUsage: number; // MB estimado
  latency: number; // ms estimado
}

// ============================================================================
// TIPOS DE MENSAGEM
// ============================================================================

export interface TurboMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  status?: string;
  hasMedia?: boolean;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker";
  mediaUrl?: string;
  mediaMimetype?: string;
  quotedMessage?: TurboMessage;
  participant?: string; // Para grupos
}

export interface TurboContact {
  id: string;
  jid: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  isGroup: boolean;
  lid?: string;
  phoneNumber?: string;
}

export interface TurboGroup {
  id: string;
  jid: string;
  name: string;
  participants: Array<{
    id: string;
    jid: string;
    name?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  subject?: string;
  description?: string;
  profilePicUrl?: string;
}

// ============================================================================
// TIPOS DE EVENTOS
// ============================================================================

export interface TurboConnectionUpdate {
  status: EngineStatus;
  qrCode?: string;
  qrTimeout?: number;
  isNewLogin?: boolean;
  error?: string;
  reason?: string;
}

export interface TurboMessageUpdate {
  type: "new" | "update" | "delete";
  messages: TurboMessage[];
  fromMe?: boolean;
}

export interface TurboPresenceUpdate {
  jid: string;
  participant?: string;
  presence: "unavailable" | "available" | "composing" | "recording" | "paused";
}

// ============================================================================
// CALLBACKS DE EVENTOS
// ============================================================================

export type OnConnectionUpdate = (update: TurboConnectionUpdate) => void;
export type OnMessage = (message: TurboMessage) => void;
export type OnMessageUpdate = (update: TurboMessageUpdate) => void;
export type OnPresenceUpdate = (update: TurboPresenceUpdate) => void;
export type OnContactsUpdate = (contacts: TurboContact[]) => void;
export type OnGroupsUpdate = (groups: TurboGroup[]) => void;

// ============================================================================
// INTERFACE PRINCIPAL
// ============================================================================

export interface ITurboEngine {
  // Identificação
  readonly type: EngineType;
  readonly info: EngineInfo;
  
  // Estado
  getStatus(): EngineStatus;
  getHealth(): HealthStatus;
  isConnected(): boolean;
  
  // Conexão
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  
  // Eventos
  onConnectionUpdate(callback: OnConnectionUpdate): void;
  onMessage(callback: OnMessage): void;
  onMessageUpdate(callback: OnMessageUpdate): void;
  onPresenceUpdate(callback: OnPresenceUpdate): void;
  onContactsUpdate(callback: OnContactsUpdate): void;
  onGroupsUpdate(callback: OnGroupsUpdate): void;
  
  // Envio de mensagens
  sendText(to: string, text: string): Promise<TurboMessage>;
  sendMedia(
    to: string,
    media: Buffer | string,
    type: "image" | "video" | "audio" | "document",
    options?: {
      caption?: string;
      filename?: string;
      mimetype?: string;
    }
  ): Promise<TurboMessage>;
  sendDocument(
    to: string,
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<TurboMessage>;
  sendReaction(to: string, messageId: string, emoji: string): Promise<void>;
  sendLocation(to: string, latitude: number, longitude: number, name?: string): Promise<TurboMessage>;
  sendContact(to: string, contact: TurboContact): Promise<TurboMessage>;
  
  // Histórico
  fetchHistory(
    jid: string,
    options?: {
      limit?: number;
      before?: string; // message ID
      after?: string; // message ID
    }
  ): Promise<TurboMessage[]>;
  
  // Contatos
  getProfilePicture(jid: string): Promise<string | null>;
  getContact(jid: string): Promise<TurboContact | null>;
  resolveLid(lid: string): Promise<string | null>; // Retorna phone number
  
  // Grupos
  getGroupMetadata(jid: string): Promise<TurboGroup | null>;
  createGroup(name: string, participants: string[]): Promise<TurboGroup>;
  addParticipant(groupJid: string, participantJid: string): Promise<void>;
  removeParticipant(groupJid: string, participantJid: string): Promise<void>;
  promoteParticipant(groupJid: string, participantJid: string): Promise<void>;
  demoteParticipant(groupJid: string, participantJid: string): Promise<void>;
  
  // Labels (se suportado)
  getLabels?(): Promise<Array<{ id: string; name: string; color: string }>>;
  setChatLabel?(chatJid: string, labelId: string): Promise<void>;
  removeChatLabel?(chatJid: string, labelId: string): Promise<void>;
  
  // Typing simulation (se suportado)
  simulateTyping?(to: string, duration: number): Promise<void>;
  simulateRecording?(to: string, duration: number): Promise<void>;
  
  // Health check
  ping(): Promise<boolean>;
  
  // Cleanup
  destroy(): Promise<void>;
}

// ============================================================================
// FACTORY
// ============================================================================

export interface TurboEngineFactory {
  create(
    type: EngineType,
    config: {
      sessionId: string;
      companyId: number;
      whatsappId: number;
      sessionPath: string;
    }
  ): Promise<ITurboEngine>;
  
  getSupportedEngines(): EngineType[];
  getEngineInfo(type: EngineType): EngineInfo;
}
