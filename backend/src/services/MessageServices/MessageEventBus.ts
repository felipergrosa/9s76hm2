import { EventEmitter } from "events";
import logger from "../../utils/logger";
import { emitSocketEvent } from "../../queues/socketEventQueue";

// CQRS Básico: Event Bus para separar comandos de queries
// Todos os eventos de mensagem passam por aqui antes de serem propagados

export interface MessageEvent {
  type: "MESSAGE_CREATED" | "MESSAGE_UPDATED" | "MESSAGE_DELETED" | "MESSAGE_ACK_UPDATED";
  companyId: number;
  ticketId: number;
  ticketUuid: string;
  messageId: number;
  payload: any;
  timestamp: Date;
}

class MessageEventBus extends EventEmitter {
  private static instance: MessageEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Aumenta limite de listeners
    this.setupHandlers();
  }

  static getInstance(): MessageEventBus {
    if (!MessageEventBus.instance) {
      MessageEventBus.instance = new MessageEventBus();
    }
    return MessageEventBus.instance;
  }

  // Configura handlers padrão
  private setupHandlers(): void {
    // Handler para emissão Socket.IO
    this.on("MESSAGE_CREATED", async (event: MessageEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          event.ticketUuid,
          `company-${event.companyId}-appMessage`,
          { action: "create", ...event.payload }
        );
      } catch (err) {
        logger.error("[MessageEventBus] Erro ao emitir MESSAGE_CREATED:", err);
      }
    });

    this.on("MESSAGE_UPDATED", async (event: MessageEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          event.ticketUuid,
          `company-${event.companyId}-appMessage`,
          { action: "update", ...event.payload }
        );
      } catch (err) {
        logger.error("[MessageEventBus] Erro ao emitir MESSAGE_UPDATED:", err);
      }
    });

    this.on("MESSAGE_DELETED", async (event: MessageEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          event.ticketUuid,
          `company-${event.companyId}-appMessage`,
          { action: "delete", messageId: event.messageId, ...event.payload }
        );
      } catch (err) {
        logger.error("[MessageEventBus] Erro ao emitir MESSAGE_DELETED:", err);
      }
    });

    this.on("MESSAGE_ACK_UPDATED", async (event: MessageEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          event.ticketUuid,
          `company-${event.companyId}-appMessage`,
          { action: "update", ...event.payload }
        );
      } catch (err) {
        logger.error("[MessageEventBus] Erro ao emitir MESSAGE_ACK_UPDATED:", err);
      }
    });

    // Log de todos os eventos (para debug)
    if (process.env.CQRS_DEBUG === "true") {
      this.onAny((eventType, event) => {
        logger.debug(`[MessageEventBus] ${eventType}:`, {
          messageId: event?.messageId,
          ticketId: event?.ticketId,
          companyId: event?.companyId
        });
      });
    }
  }

  // Listener para qualquer evento (debug)
  private onAny(callback: (eventType: string, event: MessageEvent) => void): void {
    const originalEmit = this.emit.bind(this);
    this.emit = (eventType: string | symbol, ...args: any[]) => {
      if (typeof eventType === "string") {
        callback(eventType, args[0]);
      }
      return originalEmit(eventType, ...args);
    };
  }

  // Publica um evento de mensagem
  publish(event: MessageEvent): void {
    this.emit(event.type, event);
    
    if (process.env.CQRS_DEBUG === "true") {
      logger.debug(`[MessageEventBus] Evento publicado: ${event.type}`, {
        messageId: event.messageId,
        ticketId: event.ticketId
      });
    }
  }

  // Atalhos para publicar eventos específicos
  publishMessageCreated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    messageId: number,
    message: any,
    ticket?: any,
    contact?: any
  ): void {
    this.publish({
      type: "MESSAGE_CREATED",
      companyId,
      ticketId,
      ticketUuid,
      messageId,
      payload: { message, ticket, contact },
      timestamp: new Date()
    });
  }

  publishMessageUpdated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    messageId: number,
    message: any
  ): void {
    this.publish({
      type: "MESSAGE_UPDATED",
      companyId,
      ticketId,
      ticketUuid,
      messageId,
      payload: { message },
      timestamp: new Date()
    });
  }

  publishMessageDeleted(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    messageId: number
  ): void {
    this.publish({
      type: "MESSAGE_DELETED",
      companyId,
      ticketId,
      ticketUuid,
      messageId,
      payload: {},
      timestamp: new Date()
    });
  }

  publishAckUpdated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    messageId: number,
    message: any
  ): void {
    this.publish({
      type: "MESSAGE_ACK_UPDATED",
      companyId,
      ticketId,
      ticketUuid,
      messageId,
      payload: { message },
      timestamp: new Date()
    });
  }
}

// Exporta instância singleton
export const messageEventBus = MessageEventBus.getInstance();
export default MessageEventBus;
