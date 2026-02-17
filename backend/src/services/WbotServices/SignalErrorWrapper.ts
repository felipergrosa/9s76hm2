/**
 * WRAPPER SEGURO PARA SIGNAL ERROR HANDLER
 * Adiciona tratamento de erros como CAMADA EXTRA sem modificar código existente
 */
import logger from "../../utils/logger";
import SignalErrorHandler from "./SignalErrorHandler";

/**
 * Função wrapper que executa uma operação com fallback para SignalErrorHandler
 * Uso: await withSignalFallback(whatsappId, () => operacaoOriginal())
 */
export async function withSignalFallback<T>(
  whatsappId: number,
  operation: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    // Executa operação original normalmente
    return await operation();
  } catch (error: any) {
    // Se for erro Signal, tenta tratamento
    if (SignalErrorHandler.isSignalError(error)) {
      logger.warn(`[SignalFallback] Erro Signal detectado${context ? ` em ${context}` : ''}: ${error.message}`);
      
      // Tenta recuperação em background (não bloqueia)
      SignalErrorHandler.handleSignalError(whatsappId, error).catch(err => {
        logger.error(`[SignalFallback] Falha na recuperação: ${err.message}`);
      });
      
      // Retorna null para não quebrar o fluxo
      return null;
    }
    
    // Se não for erro Signal, propaga erro normalmente
    throw error;
  }
}

/**
 * Verifica se um erro é do tipo Signal
 */
export function isSignalError(error: any): boolean {
  return SignalErrorHandler.isSignalError(error);
}

/**
 * Trata erro Signal manualmente (se necessário)
 */
export async function handleSignalError(whatsappId: number, error: any): Promise<boolean> {
  return SignalErrorHandler.handleSignalError(whatsappId, error);
}
