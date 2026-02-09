import { EventEmitter } from "events";
import logger from "../../utils/logger";
import { emitSocketEvent } from "../../queues/socketEventQueue";

// CQRS: Event Bus para Tickets
// Todos os eventos de ticket passam por aqui antes de serem propagados

export interface TicketEvent {
  type: "TICKET_CREATED" | "TICKET_UPDATED" | "TICKET_DELETED" | "TICKET_STATUS_CHANGED" | "TICKET_UNREAD_UPDATED";
  companyId: number;
  ticketId: number;
  ticketUuid: string;
  payload: any;
  timestamp: Date;
}

class TicketEventBus extends EventEmitter {
  private static instance: TicketEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
    this.setupHandlers();
  }

  static getInstance(): TicketEventBus {
    if (!TicketEventBus.instance) {
      TicketEventBus.instance = new TicketEventBus();
    }
    return TicketEventBus.instance;
  }

  // Configura handlers padrão para emissão Socket.IO
  private setupHandlers(): void {
    // Ticket criado
    this.on("TICKET_CREATED", async (event: TicketEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          null, // Broadcast para toda empresa
          `company-${event.companyId}-ticket`,
          { action: "create", ...event.payload }
        );
      } catch (err) {
        logger.error("[TicketEventBus] Erro ao emitir TICKET_CREATED:", err);
      }
    });

    // Ticket atualizado
    this.on("TICKET_UPDATED", async (event: TicketEvent) => {
      try {
        const payload = { action: "update", ...event.payload };
        console.log(`[TicketEventBus DEBUG] TICKET_UPDATED ticketId=${event.ticketId} status=${event.payload?.ticket?.status || event.payload?.status} companyId=${event.companyId}`);
        await emitSocketEvent(
          event.companyId,
          null,
          `company-${event.companyId}-ticket`,
          payload
        );
      } catch (err) {
        logger.error("[TicketEventBus] Erro ao emitir TICKET_UPDATED:", err);
      }
    });

    // Ticket deletado
    this.on("TICKET_DELETED", async (event: TicketEvent) => {
      try {
        const payload = { action: "delete", ticketId: event.ticketId, ...event.payload };
        console.log(`[TicketEventBus DEBUG] TICKET_DELETED ticketId=${event.ticketId} oldStatus=${event.payload?.oldStatus} companyId=${event.companyId}`);
        await emitSocketEvent(
          event.companyId,
          null,
          `company-${event.companyId}-ticket`,
          payload
        );
      } catch (err) {
        logger.error("[TicketEventBus] Erro ao emitir TICKET_DELETED:", err);
      }
    });

    // Status do ticket mudou
    this.on("TICKET_STATUS_CHANGED", async (event: TicketEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          null,
          `company-${event.companyId}-ticket`,
          { action: "update", ...event.payload }
        );
      } catch (err) {
        logger.error("[TicketEventBus] Erro ao emitir TICKET_STATUS_CHANGED:", err);
      }
    });

    // Contagem de não lidos atualizada
    this.on("TICKET_UNREAD_UPDATED", async (event: TicketEvent) => {
      try {
        await emitSocketEvent(
          event.companyId,
          null,
          `company-${event.companyId}-ticket`,
          { action: "updateUnread", ticketId: event.ticketId, ...event.payload }
        );
      } catch (err) {
        logger.error("[TicketEventBus] Erro ao emitir TICKET_UNREAD_UPDATED:", err);
      }
    });

    // Debug log
    if (process.env.CQRS_DEBUG === "true") {
      this.onAny((eventType, event) => {
        logger.debug(`[TicketEventBus] ${eventType}:`, {
          ticketId: event?.ticketId,
          companyId: event?.companyId
        });
      });
    }
  }

  // Listener para qualquer evento (debug)
  private onAny(callback: (eventType: string, event: TicketEvent) => void): void {
    const originalEmit = this.emit.bind(this);
    this.emit = (eventType: string | symbol, ...args: any[]) => {
      if (typeof eventType === "string") {
        callback(eventType, args[0]);
      }
      return originalEmit(eventType, ...args);
    };
  }

  // Publica um evento de ticket
  publish(event: TicketEvent): void {
    this.emit(event.type, event);
    
    if (process.env.CQRS_DEBUG === "true") {
      logger.debug(`[TicketEventBus] Evento publicado: ${event.type}`, {
        ticketId: event.ticketId
      });
    }
  }

  // Atalhos para publicar eventos específicos
  publishTicketCreated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    ticket: any,
    contact?: any
  ): void {
    this.publish({
      type: "TICKET_CREATED",
      companyId,
      ticketId,
      ticketUuid,
      payload: { ticket, contact },
      timestamp: new Date()
    });
  }

  publishTicketUpdated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    ticket: any
  ): void {
    this.publish({
      type: "TICKET_UPDATED",
      companyId,
      ticketId,
      ticketUuid,
      payload: { ticket },
      timestamp: new Date()
    });
  }

  publishTicketDeleted(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    oldStatus?: string
  ): void {
    this.publish({
      type: "TICKET_DELETED",
      companyId,
      ticketId,
      ticketUuid,
      payload: { oldStatus },
      timestamp: new Date()
    });
  }

  publishStatusChanged(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    ticket: any,
    oldStatus: string,
    newStatus: string
  ): void {
    this.publish({
      type: "TICKET_STATUS_CHANGED",
      companyId,
      ticketId,
      ticketUuid,
      payload: { ticket, oldStatus, newStatus },
      timestamp: new Date()
    });
  }

  publishUnreadUpdated(
    companyId: number,
    ticketId: number,
    ticketUuid: string,
    unreadCount: number
  ): void {
    this.publish({
      type: "TICKET_UNREAD_UPDATED",
      companyId,
      ticketId,
      ticketUuid,
      payload: { unreadCount },
      timestamp: new Date()
    });
  }
}

// Exporta instância singleton
export const ticketEventBus = TicketEventBus.getInstance();
export default TicketEventBus;
