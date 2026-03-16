import io from "socket.io-client";
import { getBackendUrl } from "../config";
import logger from "../utils/logger";

class SocketWorker {
  constructor(companyId, userId) {
    if (!SocketWorker.instance) {
      this.companyId = companyId
      this.userId = userId
      this.socket = null;
      this.configureSocket();
      this.eventListeners = {}; // Armazena os ouvintes de eventos registrados
      this.joinBuffer = new Set(); // Rooms pendentes de join
      this.activeRooms = new Set(); // Salas ativas que devem ser re-unidas após reconexão
      this.healthCheckInterval = null; // Intervalo de health check
      SocketWorker.instance = this;

    }

    return SocketWorker.instance;
  }

  // Checa presença do socket na sala (diagnóstico)
  checkRoom(room, cb) {
    try {
      const normalized = (room || "").toString().trim();
      if (!normalized || normalized === "undefined") return cb?.({ error: "invalid room" });
      this.connect();
      this.socket.emit("debugCheckRoom", normalized, cb);
    } catch (e) {
      cb?.({ error: e?.message || String(e) });
    }
  }

  // Proxy da flag de conexão
  get connected() {
    return !!this.socket && !!this.socket.connected;
  }

  configureSocket() {
    // Token correto vem em localStorage na chave "token" como JSON string
    let token = null;
    try {
      const raw = localStorage.getItem("token");
      token = raw ? JSON.parse(raw) : null;
    } catch (_) {
      token = null;
    }
    const backendUrl = getBackendUrl() || process.env.REACT_APP_BACKEND_URL;
    const nsUrl = `${backendUrl}/workspace-${this?.companyId}`;
    // Importante: o backend valida namespaces como /workspace-<id> e exige query.token (JWT)
    this.socket = io(nsUrl, {
      transports: ["websocket", "polling"], // Prioriza websocket, fallback para polling
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000, // Timeout de conexão inicial
      pingTimeout: 60000, // Aumentado de 20s para 60s
      pingInterval: 25000,
      upgrade: true, // Permite upgrade de polling para websocket
      rememberUpgrade: true, // Lembra que websocket funciona
      query: token ? { token, userId: String(this.userId) } : { userId: String(this.userId) }
      // auth: token ? { token } : undefined, // opcional, backend lê de query.token
    });

    // Expondo para debug manual no console do navegador
    try {
      if (typeof window !== "undefined") {
        window.__SOCKET_WORKER__ = this;
        window.__SOCKET_IO__ = this.socket;
      }
    } catch { }

    this.socket.on("connect", () => {
      // Sempre refaz joins das salas ativas após qualquer conexão
      // (mesmo recovered, pois o servidor pode ter perdido o estado)
      try {
        // Primeiro, refaz join das salas ativas
        this.activeRooms.forEach((room) => {
          try {
            this.socket.emit("joinChatBox", room, (err) => {
              // Callback silencioso
            });
          } catch (e) {
            // Silenciar erros
          }
        });
        
        // Depois, processa o buffer de joins pendentes
        this.joinBuffer.forEach((room) => {
          try {
            this.socket.emit("joinChatBox", room, (err) => {
              if (!err) {
                this.activeRooms.add(room); // Adiciona às salas ativas
              }
            });
          } catch (e) {
            // Silenciar erros
          }
        });
      } finally {
        this.joinBuffer.clear();
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.reconnectAfterDelay();
    });

    // Evento customizado: sessão do WhatsApp desconectou (emitido pelo backend)
    this.socket.on("wa-conn-lost", (data) => {
      try {
        if (typeof window !== "undefined") {
          const evt = new CustomEvent("wa-conn-lost", { detail: data });
          window.dispatchEvent(evt);
        }
      } catch (e) {
        // Silenciar erros
      }
    });

    this.socket.on("connect_error", (err) => {
      // Silencioso para evitar spam no console
    });
    this.socket.on("error", (err) => {
      // Silencioso para evitar spam no console
    });
  }

  // Adiciona um ouvinte de eventos permitindo múltiplos listeners por evento
  // Evita apenas duplicata do MESMO callback (referência idêntica)
  on(event, callback) {
    this.connect();
    
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    // Evitar duplicata: se o mesmo callback já está registrado, remove antes de re-adicionar
    const idx = this.eventListeners[event].indexOf(callback);
    if (idx !== -1) {
      this.socket.off(event, callback);
      this.eventListeners[event].splice(idx, 1);
    }
    
    this.socket.on(event, callback);
    this.eventListeners[event].push(callback);
  }

  // Emite um evento
  emit(event, ...args) {
    this.connect();
    this.socket.emit(event, ...args);
  }

  // Join de sala com buffer automático e registro de salas ativas
  joinRoom(room, cb) {
    try {
      const normalized = (room || "").toString().trim();
      if (!normalized || normalized === "undefined") {
        return cb?.("invalid room");
      }
      
      // Sempre adiciona às salas ativas para rejoin após reconexão
      this.activeRooms.add(normalized);
      
      if (this.connected) {
        this.socket.emit("joinChatBox", normalized, (err) => {
          cb?.(err);
        });
      } else {
        this.joinBuffer.add(normalized);
        cb?.();
      }
    } catch (e) {
      cb?.(e?.message || String(e));
    }
  }

  // Leave de sala com segurança e remoção do registro
  leaveRoom(room, cb) {
    try {
      const normalized = (room || "").toString().trim();
      if (!normalized || normalized === "undefined") return cb?.("invalid room");
      
      // Remove das salas ativas
      this.activeRooms.delete(normalized);
      this.joinBuffer.delete(normalized);
      
      if (this.connected) {
        this.socket.emit("joinChatBoxLeave", normalized, cb);
      } else {
        cb?.();
      }
    } catch (e) {
      cb?.(e?.message || String(e));
    }
  }

  // Desconecta um ou mais ouvintes de eventos
  off(event, callback) {
    if (this.eventListeners[event]) {
      // console.log("Desconectando do servidor Socket.IO:", event, callback);
      if (callback) {
        // Desconecta um ouvinte específico
        this.socket.off(event, callback);
        this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
      } else {
        // console.log("DELETOU EVENTOS DO SOCKET:", this.eventListeners[event]);

        // Desconecta todos os ouvintes do evento
        this.eventListeners[event].forEach(cb => this.socket.off(event, cb));
        delete this.eventListeners[event];
      }
      // console.log("EVENTOS DO SOCKET:", this.eventListeners);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null
      this.instance = null
    }
  }

  reconnectAfterDelay() {
    setTimeout(() => {
      if (!this.socket || !this.socket.connected) {
        this.connect();
      }
    }, 3000); // Aumentado para 3s
  }

  // Garante que o socket esteja conectado
  connect() {
    if (!this.socket) {
      this.configureSocket();
      return;
    }

    try {
      if (!this.socket.connected && typeof this.socket.connect === "function") {
        this.socket.connect();
      }
    } catch (e) { }
  }

  // Inicia health check periódico para verificar se está na sala
  startHealthCheck(room, intervalMs = 30000) {
    this.stopHealthCheck();
    
    this.healthCheckInterval = setInterval(() => {
      if (!this.connected) {
        this.connect();
        return;
      }
      
      this.checkRoom(room, (res) => {
        if (!res?.present) {
          this.joinRoom(room, () => {});
        }
      });
    }, intervalMs);
  }

  // Para o health check
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  forceReconnect() {

  }
}

// const instance = (companyId, userId) => new SocketWorker(companyId,userId);
const instance = (companyId, userId) => new SocketWorker(companyId, userId);

export default instance;
