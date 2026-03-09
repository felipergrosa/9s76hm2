import rateLimit from 'express-rate-limit';

// Rate limiting para endpoints de mensagens (evita polling excessivo)
export const messageRateLimit = rateLimit({
  windowMs: 15 * 1000, // 15 segundos
  max: 10, // máximo 10 requisições por IP
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip se for WebSocket ou Socket.IO
  skip: (req) => {
    return req.path.includes('/socket.io/') || 
           req.headers.upgrade === 'websocket';
  }
});

// Rate limiting mais rigoroso para listagem de mensagens
export const listMessagesRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // máximo 20 listagens por IP
  message: {
    error: 'Too many message list requests',
    code: 'MESSAGE_LIST_RATE_LIMIT'
  }
});
