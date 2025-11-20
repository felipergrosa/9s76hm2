// Mock para @whiskeysockets/baileys para testes
module.exports = {
  default: jest.fn(),
  makeWASocket: jest.fn(),
  useMultiFileAuthState: jest.fn(),
  DisconnectReason: {
    connectionClosed: "connectionClosed",
    connectionLost: "connectionLost",
    restartRequired: "restartRequired",
    timedOut: "timedOut",
  },
  ConnectionState: {
    close: "close",
    connecting: "connecting",
    open: "open",
  },
  fetchLatestBaileysVersion: jest.fn(),
  Browsers: {
    ubuntu: ["Ubuntu", "Chrome", "20.0.04"],
    macOS: ["Mac OS", "Chrome", "20.0.04"],
    baileys: ["Baileys", "Chrome", "20.0.04"],
  },
};

