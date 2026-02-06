/**
 * Logger condicional - só exibe logs em desenvolvimento
 * Em produção, todos os logs são silenciados para melhor performance
 */

const isDev = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    // Erros sempre são exibidos (importantes para debugging em produção)
    console.error(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  table: (...args) => {
    if (isDev) console.table(...args);
  },
  group: (...args) => {
    if (isDev) console.group(...args);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
  time: (label) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label) => {
    if (isDev) console.timeEnd(label);
  }
};

export default logger;
