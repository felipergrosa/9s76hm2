/**
 * CONFIGURAÇÕES DE OTIMIZAÇÃO EXTREMA
 * 
 * Ajuste estas variáveis conforme necessário para seu ambiente
 */

export const OptimizationConfig = {
  // Cache
  cache: {
    enabled: process.env.CACHE_ENABLED !== "false",
    ttl: {
      contacts: 300, // 5 minutos
      tickets: 60, // 1 minuto
      messages: 30, // 30 segundos
      users: 600, // 10 minutos
      queues: 3600 // 1 hora
    }
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    api: {
      windowMs: 60000, // 1 minuto
      maxRequests: 100 // 100 req/min por IP
    },
    messages: {
      windowMs: 60000, // 1 minuto
      maxRequests: 60 // 60 msg/min por conexão WhatsApp
    },
    login: {
      windowMs: 900000, // 15 minutos
      maxRequests: 5 // 5 tentativas de login
    }
  },

  // Performance Monitoring
  monitoring: {
    enabled: process.env.PERF_MONITORING_ENABLED !== "false",
    slowThreshold: 1000, // 1s
    criticalThreshold: 3000 // 3s
  },

  // Database
  database: {
    // Pool já configurado em database.ts
    queryTimeout: 30000, // 30s
    logSlowQueries: true,
    slowQueryThreshold: 1000 // 1s
  },

  // Media Processing
  media: {
    processInBackground: true,
    maxConcurrentJobs: 5,
    compressionQuality: 85,
    thumbnailSize: 200,
    maxFileSizeMB: 10
  },

  // Bull Queues
  queues: {
    cleanInterval: 300000, // 5 minutos
    retentionCompleted: 5000, // 5 segundos
    retentionFailed: 86400000 // 24 horas
  },

  // Socket.IO
  socket: {
    maxListeners: 50,
    pingTimeout: 60000,
    pingInterval: 25000
  }
};

export default OptimizationConfig;
