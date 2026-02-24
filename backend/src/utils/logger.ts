import pino from 'pino';
import moment from 'moment-timezone';

// Função para obter o timestamp com fuso horário
const timezoned = () => {
  return moment().tz('America/Sao_Paulo').format('DD-MM-YYYY HH:mm:ss');
};

/**
 * Sanitiza mensagem do Baileys para log, removendo buffers/binários
 * que poluem o terminal com base64
 */
export const sanitizeMessageForLog = (msg: any): any => {
  if (!msg || typeof msg !== 'object') return msg;
  
  // Se for Buffer, retornar indicador
  if (Buffer.isBuffer(msg)) {
    return `<Buffer:${msg.length}>`;
  }
  
  // Se for array, mapear recursivamente
  if (Array.isArray(msg)) {
    return msg.map(sanitizeMessageForLog);
  }
  
  // Objeto: iterar sobre chaves
  const sanitized: any = {};
  for (const [key, value] of Object.entries(msg)) {
    // Pular campos que costumam ter dados binários grandes
    if (key === 'file' || key === 'buffer' || key === 'data' || 
        key === 'stream' || key === 'content' || key === 'mediaData') {
      sanitized[key] = value ? `<${typeof value}:${key}>` : null;
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = `<Buffer:${(value as Buffer).length}>`;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMessageForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

const logger = pino({
  ...(process.env.NODE_ENV === "test"
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss', // Use this para tradução de tempo
            ignore: "pid,hostname"
          }
        }
      }),
  timestamp: () => `,"time":"${timezoned()}"`, // Adiciona o timestamp formatado
});

export default logger;
