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

// Rate limit para endpoints de autenticação (previne brute force).
// Aplicado por IP. Em caso de proxy reverso, trust proxy já está configurado em app.ts.
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 tentativas de login por minuto por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em instantes.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit estrito para recuperação de senha (previne spam de e-mails).
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // máximo 3 solicitações por minuto por IP
  message: {
    error: 'Muitas solicitações de recuperação. Tente novamente em instantes.',
    code: 'FORGOT_PASSWORD_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit para signup público (previne criação em massa de contas).
export const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 signups por hora por IP
  message: {
    error: 'Limite de cadastros excedido. Tente novamente mais tarde.',
    code: 'SIGNUP_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});
