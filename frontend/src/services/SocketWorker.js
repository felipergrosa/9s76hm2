import io from "socket.io-client";
import { getBackendUrl } from "../config";

class SocketWorker {
  constructor(companyId , userId) {
    if (!SocketWorker.instance) {
      this.companyId = companyId
      this.userId = userId
      this.socket = null;
      this.configureSocket();
      this.eventListeners = {}; // Armazena os ouvintes de eventos registrados
      this.joinBuffer = new Set(); // Rooms pendentes de join
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
      transports: ["polling", "websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      pingTimeout: 20000,
      pingInterval: 25000,
      query: token ? { token, userId: String(this.userId) } : { userId: String(this.userId) }
      // auth: token ? { token } : undefined, // opcional, backend lê de query.token
    });

    // Expondo para debug manual no console do navegador
    try {
      if (typeof window !== "undefined") {
        window.__SOCKET_WORKER__ = this;
        window.__SOCKET_IO__ = this.socket;
      }
    } catch {}

    this.socket.on("connect", () => {
      console.log("Socket conectado:", { namespace: `workspace-${this?.companyId}`, id: this.socket?.id, hasToken: !!token });
      // Envia joins pendentes
      try {
        this.joinBuffer.forEach((room) => {
          try {
            this.socket.emit("joinChatBox", room, (err) => {
              if (err) console.log("[SocketWorker] buffered join ack error", { room, err });
              else console.log("[SocketWorker] buffered join ok", { room });
            });
          } catch (e) {}
        });
      } finally {
        this.joinBuffer.clear();
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Desconectado do servidor Socket.IO");
      this.reconnectAfterDelay();
    });

    this.socket.on("connect_error", (err) => {
      console.log("Socket connect_error:", err?.message || err);
    });
    this.socket.on("error", (err) => {
      console.log("Socket error:", err?.message || err);
    });
  }

  // Adiciona um ouvinte de eventos
  on(event, callback) {
    this.connect();
    this.socket.on(event, callback);

    // Armazena o ouvinte no objeto de ouvintes
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  // Emite um evento
  emit(event, ...args) {
    this.connect();
    this.socket.emit(event, ...args);
  }

  // Join de sala com buffer automático
  joinRoom(room, cb) {
    try {
      const normalized = (room || "").toString().trim();
      if (!normalized || normalized === "undefined") return cb?.("invalid room");
      if (this.connected) {
        this.socket.emit("joinChatBox", normalized, cb);
      } else {
        this.joinBuffer.add(normalized);
        cb?.();
      }
    } catch (e) {
      cb?.(e?.message || String(e));
    }
  }

  // Leave de sala com segurança
  leaveRoom(room, cb) {
    try {
      const normalized = (room || "").toString().trim();
      if (!normalized || normalized === "undefined") return cb?.("invalid room");
      if (this.connected) {
        this.socket.emit("joinChatBoxLeave", normalized, cb);
      } else {
        // Se desconectado, apenas remove do buffer
        this.joinBuffer.delete(normalized);
        cb?.();
      }
    } catch (e) {
      cb?.(e?.message || String(e));
    }
  }

  // Desconecta um ou mais ouvintes de eventos
  off(event, callback) {
    this.connect();
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
      console.log("Socket desconectado manualmente");
    }
  }

  reconnectAfterDelay() {
    setTimeout(() => {
      if (!this.socket || !this.socket.connected) {
        console.log("Tentando reconectar após desconexão");
        this.connect();
      }
    }, 1000);
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
    } catch (e) {}
  }

  forceReconnect() {

  }
}

// const instance = (companyId, userId) => new SocketWorker(companyId,userId);
const instance = (companyId, userId) => new SocketWorker(companyId, userId);

export default instance;
