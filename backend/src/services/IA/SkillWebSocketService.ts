/**
 * SkillWebSocketService.ts
 * 
 * WebSocket para notificações em tempo real de alterações em Skills
 * Canal: /skills
 * Eventos: skill:updated, skill:created, skill:deleted, skill:sync
 */

import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { skillCache } from "./SkillCacheService";
import { Server as SocketIO } from "socket.io";

interface SkillEventPayload {
  skillId: number;
  agentId?: number;
  companyId: number;
  hash: string;
  version: string;
  timestamp: string;
  action: "created" | "updated" | "deleted" | "sync";
  changes?: string[];
}

interface SyncRequestPayload {
  companyId: number;
  agentId?: number;
  currentVersion?: string;
}

interface SyncResponsePayload {
  companyId: number;
  agentId?: number;
  hasChanges: boolean;
  newVersion?: string;
  skills?: any[];
  timestamp: string;
}

class SkillWebSocketService {
  private readonly NAMESPACE = "/skills";
  private initialized = false;

  /**
   * Inicializar o namespace de skills
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const io = getIO();
    const skillsIo = io.of(this.NAMESPACE);

    skillsIo.on("connection", (socket) => {
      logger.info(`[SkillWS] Cliente conectado: ${socket.id}`);

      // Autenticação via token
      socket.on("authenticate", (data: { companyId: number; token: string }) => {
        const { companyId, token } = data;
        
        // Validar token (simplificado - usar middleware real em produção)
        if (!companyId || !token) {
          socket.emit("error", { message: "Autenticação requerida" });
          return;
        }

        socket.join(`company:${companyId}`);
        logger.info(`[SkillWS] Cliente autenticado: ${socket.id}, empresa: ${companyId}`);
        socket.emit("authenticated", { success: true });
      });

      // Entrar em sala de agente específico
      socket.on("subscribe:agent", (data: { agentId: number; companyId: number }) => {
        const { agentId, companyId } = data;
        socket.join(`agent:${companyId}:${agentId}`);
        logger.debug(`[SkillWS] Inscrito em agente: ${agentId}, empresa: ${companyId}`);
        socket.emit("subscribed", { agentId, companyId });
      });

      // Sair da sala de agente
      socket.on("unsubscribe:agent", (data: { agentId: number; companyId: number }) => {
        const { agentId, companyId } = data;
        socket.leave(`agent:${companyId}:${agentId}`);
        logger.debug(`[SkillWS] Desinscrito de agente: ${agentId}`);
        socket.emit("unsubscribed", { agentId, companyId });
      });

      // Request de sync - verificar se há mudanças
      socket.on("sync:request", async (data: SyncRequestPayload) => {
        const { companyId, agentId, currentVersion } = data;
        
        try {
          const hasChanges = await skillCache.hasChanges(companyId, agentId);
          const newVersion = skillCache.getCurrentVersion(companyId, agentId);

          const response: SyncResponsePayload = {
            companyId,
            agentId,
            hasChanges,
            newVersion: newVersion || undefined,
            timestamp: new Date().toISOString()
          };

          // Se tem mudanças, enviar skills atualizadas
          if (hasChanges) {
            const skills = await skillCache.getSkills(companyId, agentId, true);
            response.skills = skills.map(s => ({
              id: s.id,
              name: s.name,
              category: s.category,
              hash: s.hash,
              version: s.version,
              enabled: s.enabled
            }));
          }

          socket.emit("sync:response", response);
        } catch (error) {
          logger.error("[SkillWS] Erro no sync:", error);
          socket.emit("sync:error", { message: "Erro ao sincronizar skills" });
        }
      });

      // Force refresh
      socket.on("sync:force", async (data: SyncRequestPayload) => {
        const { companyId, agentId } = data;
        
        try {
          await skillCache.refreshAsync(companyId, agentId);
          const skills = await skillCache.getSkills(companyId, agentId, true);
          
          socket.emit("sync:complete", {
            companyId,
            agentId,
            skills,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error("[SkillWS] Erro no force sync:", error);
          socket.emit("sync:error", { message: "Erro ao forçar sincronização" });
        }
      });

      // Heartbeat
      socket.on("ping", () => {
        socket.emit("pong", { timestamp: Date.now() });
      });

      // Disconnect
      socket.on("disconnect", (reason) => {
        logger.info(`[SkillWS] Cliente desconectado: ${socket.id}, razão: ${reason}`);
      });
    });

    this.initialized = true;
    logger.info(`[SkillWS] Namespace ${this.NAMESPACE} inicializado`);
  }

  /**
   * Notificar todos os clientes de uma empresa sobre mudança em skill
   */
  notifySkillChange(payload: SkillEventPayload): void {
    const { companyId, agentId, action } = payload;
    
    // Notificar sala da empresa
    const io = getIO();
    io.of(this.NAMESPACE)
      .to(`company:${companyId}`)
      .emit(`skill:${action}`, payload);

    // Se tem agentId específico, notificar sala do agente também
    if (agentId) {
      io.of(this.NAMESPACE)
        .to(`agent:${companyId}:${agentId}`)
        .emit(`skill:${action}`, payload);
    }
    
    // Invalidar cache
    skillCache.invalidate(companyId, agentId);

    logger.info(`[SkillWS] Notificação enviada: skill:${action}, company=${companyId}, agent=${agentId}`);
  }

  /**
   * Notificar criação de skill
   */
  notifyCreated(skill: any): void {
    this.notifySkillChange({
      skillId: skill.id,
      agentId: skill.agentId,
      companyId: skill.companyId,
      hash: skill.hash,
      version: skill.version,
      timestamp: new Date().toISOString(),
      action: "created"
    });
  }

  /**
   * Notificar atualização de skill
   */
  notifyUpdated(skill: any, changes: string[]): void {
    this.notifySkillChange({
      skillId: skill.id,
      agentId: skill.agentId,
      companyId: skill.companyId,
      hash: skill.hash,
      version: skill.version,
      timestamp: new Date().toISOString(),
      action: "updated",
      changes
    });
  }

  /**
   * Notificar deleção de skill
   */
  notifyDeleted(skill: any): void {
    this.notifySkillChange({
      skillId: skill.id,
      agentId: skill.agentId,
      companyId: skill.companyId,
      hash: "",
      version: "",
      timestamp: new Date().toISOString(),
      action: "deleted"
    });
  }

  /**
   * Broadcast de sync para todos os clientes de uma empresa
   */
  broadcastSync(companyId: number, agentId?: number): void {
    const io = getIO();
    io.of(this.NAMESPACE)
      .to(`company:${companyId}`)
      .emit("skill:sync", {
        companyId,
        agentId,
        timestamp: new Date().toISOString(),
        message: "Sincronização de skills necessária"
      });
  }

  /**
   * Obter estatísticas de conexões
   */
  getStats(): { connections: number; rooms: string[] } {
    const io = getIO();
    const namespace = io.of(this.NAMESPACE);
    return {
      connections: namespace.sockets.size,
      rooms: Array.from(namespace.adapter.rooms?.keys() || [])
    };
  }
}

// Singleton
export const skillWebSocket = new SkillWebSocketService();
export default skillWebSocket;
