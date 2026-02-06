/**
 * Logger condicional - só exibe logs em desenvolvimento
 * Em produção, logs são silenciados para melhor performance
 * Pode ser habilitado em produção via Settings > Opções > "Habilitar Console Logs"
 */

const isDev = process.env.NODE_ENV === 'development';

// Verifica se logs estão habilitados (dev OU toggle ativado em produção)
const isLoggingEnabled = () => {
  if (isDev) return true;
  try {
    return localStorage.getItem('enableConsoleLogs') === 'true';
  } catch {
    return false;
  }
};

const logger = {
  log: (...args) => {
    if (isLoggingEnabled()) console.log(...args);
  },
  warn: (...args) => {
    if (isLoggingEnabled()) console.warn(...args);
  },
  error: (...args) => {
    // Erros sempre são exibidos (importantes para debugging em produção)
    console.error(...args);
  },
  debug: (...args) => {
    if (isLoggingEnabled()) console.debug(...args);
  },
  info: (...args) => {
    if (isLoggingEnabled()) console.info(...args);
  },
  table: (...args) => {
    if (isLoggingEnabled()) console.table(...args);
  },
  group: (...args) => {
    if (isLoggingEnabled()) console.group(...args);
  },
  groupEnd: () => {
    if (isLoggingEnabled()) console.groupEnd();
  },
  time: (label) => {
    if (isLoggingEnabled()) console.time(label);
  },
  timeEnd: (label) => {
    if (isLoggingEnabled()) console.timeEnd(label);
  },
  // Método para verificar status atual
  isEnabled: () => isLoggingEnabled(),
  // Método para ativar/desativar (usado pelo Settings)
  setEnabled: (enabled) => {
    try {
      if (enabled) {
        localStorage.setItem('enableConsoleLogs', 'true');
        console.log('[Logger] Console logs HABILITADOS para debug');
      } else {
        localStorage.removeItem('enableConsoleLogs');
        console.log('[Logger] Console logs DESABILITADOS');
      }
    } catch (e) {
      console.error('[Logger] Erro ao salvar configuração:', e);
    }
  }
};

export default logger;
