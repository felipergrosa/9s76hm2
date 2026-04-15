/**
 * skillSocket.js
 * 
 * Cliente WebSocket para comunicação em tempo real com o serviço de Skills
 * Namespace: /skills
 */

import { getSocketWorker } from "./SocketWorker";

class SkillSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.callbacks = {
      onSkillCreated: [],
      onSkillUpdated: [],
      onSkillDeleted: [],
      onSkillSync: [],
      onSyncResponse: [],
      onError: []
    };
  }

  /**
   * Conectar ao namespace /skills
   */
  connect(companyId, token) {
    if (this.socket) {
      console.log("[SkillSocket] Já conectado");
      return;
    }

    const socketWorker = getSocketWorker();
    
    // Criar conexão para o namespace /skills
    this.socket = socketWorker.io("/skills", {
      auth: { token }
    });

    this.socket.on("connect", () => {
      console.log("[SkillSocket] Conectado ao namespace /skills");
      this.connected = true;
      
      // Autenticar
      this.socket.emit("authenticate", { companyId, token });
    });

    this.socket.on("authenticated", (data) => {
      console.log("[SkillSocket] Autenticado:", data);
      this.authenticated = true;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[SkillSocket] Desconectado:", reason);
      this.connected = false;
      this.authenticated = false;
    });

    // Eventos de skills
    this.socket.on("skill:created", (payload) => {
      console.log("[SkillSocket] Skill criada:", payload);
      this.callbacks.onSkillCreated.forEach(cb => cb(payload));
    });

    this.socket.on("skill:updated", (payload) => {
      console.log("[SkillSocket] Skill atualizada:", payload);
      this.callbacks.onSkillUpdated.forEach(cb => cb(payload));
    });

    this.socket.on("skill:deleted", (payload) => {
      console.log("[SkillSocket] Skill deletada:", payload);
      this.callbacks.onSkillDeleted.forEach(cb => cb(payload));
    });

    this.socket.on("skill:sync", (payload) => {
      console.log("[SkillSocket] Sincronização necessária:", payload);
      this.callbacks.onSkillSync.forEach(cb => cb(payload));
    });

    this.socket.on("sync:response", (data) => {
      console.log("[SkillSocket] Resposta de sync:", data);
      this.callbacks.onSyncResponse.forEach(cb => cb(data));
    });

    this.socket.on("error", (error) => {
      console.error("[SkillSocket] Erro:", error);
      this.callbacks.onError.forEach(cb => cb(error));
    });

    // Heartbeat para manter conexão viva
    setInterval(() => {
      if (this.connected) {
        this.socket.emit("ping");
      }
    }, 30000);
  }

  /**
   * Desconectar
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.authenticated = false;
    }
  }

  /**
   * Inscrever em sala de agente específico
   */
  subscribeAgent(agentId, companyId) {
    if (!this.connected || !this.authenticated) {
      console.warn("[SkillSocket] Não conectado/autenticado");
      return;
    }
    this.socket.emit("subscribe:agent", { agentId, companyId });
  }

  /**
   * Cancelar inscrição de agente
   */
  unsubscribeAgent(agentId, companyId) {
    if (!this.connected) return;
    this.socket.emit("unsubscribe:agent", { agentId, companyId });
  }

  /**
   * Solicitar sincronização
   */
  requestSync(companyId, agentId, currentVersion) {
    if (!this.connected || !this.authenticated) {
      console.warn("[SkillSocket] Não conectado/autenticado");
      return;
    }
    this.socket.emit("sync:request", {
      companyId,
      agentId,
      currentVersion
    });
  }

  /**
   * Forçar refresh
   */
  forceSync(companyId, agentId) {
    if (!this.connected || !this.authenticated) {
      console.warn("[SkillSocket] Não conectado/autenticado");
      return;
    }
    this.socket.emit("sync:force", { companyId, agentId });
  }

  /**
   * Registrar callbacks
   */
  onSkillCreated(callback) {
    this.callbacks.onSkillCreated.push(callback);
    return () => {
      this.callbacks.onSkillCreated = this.callbacks.onSkillCreated.filter(cb => cb !== callback);
    };
  }

  onSkillUpdated(callback) {
    this.callbacks.onSkillUpdated.push(callback);
    return () => {
      this.callbacks.onSkillUpdated = this.callbacks.onSkillUpdated.filter(cb => cb !== callback);
    };
  }

  onSkillDeleted(callback) {
    this.callbacks.onSkillDeleted.push(callback);
    return () => {
      this.callbacks.onSkillDeleted = this.callbacks.onSkillDeleted.filter(cb => cb !== callback);
    };
  }

  onSkillSync(callback) {
    this.callbacks.onSkillSync.push(callback);
    return () => {
      this.callbacks.onSkillSync = this.callbacks.onSkillSync.filter(cb => cb !== callback);
    };
  }

  onSyncResponse(callback) {
    this.callbacks.onSyncResponse.push(callback);
    return () => {
      this.callbacks.onSyncResponse = this.callbacks.onSyncResponse.filter(cb => cb !== callback);
    };
  }

  onError(callback) {
    this.callbacks.onError.push(callback);
    return () => {
      this.callbacks.onError = this.callbacks.onError.filter(cb => cb !== callback);
    };
  }

  /**
   * Verificar status da conexão
   */
  isConnected() {
    return this.connected && this.authenticated;
  }
}

// Singleton
const skillSocket = new SkillSocketClient();
export default skillSocket;
