/**
 * LeaderService - VERSÃO SIMPLIFICADA PARA SINGLE-INSTANCE
 * 
 * Esta versão assume que SEMPRE existe apenas UMA conexão por número WhatsApp.
 * Útil para ambientes onde não há múltiplas instâncias do backend rodando.
 * 
 * Comportamento:
 * - isLeader() → SEMPRE retorna true
 * - tryBecomeLeader() → SEMPRE retorna true (no-op)
 * - releaseLeadership() → no-op
 * 
 * Se precisar de multi-instância com failover, usar wbotLeaderService.ts original.
 */

import logger from "../utils/logger";

/**
 * Verifica se esta conexão é o líder para o número
 * SINGLE-INSTANCE: Sempre retorna true
 */
export const isLeader = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  // Single-instance: sempre somos o líder
  return true;
};

/**
 * Verificação rápida local (cache)
 * SINGLE-INSTANCE: Sempre retorna true
 */
export const isLeaderCached = (phoneNumber: string): boolean => {
  return true;
};

/**
 * Tenta se tornar o líder para o número
 * SINGLE-INSTANCE: Sempre retorna true (no-op)
 */
export const tryBecomeLeader = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  logger.debug(`[LeaderService] Single-instance: assumindo líder para ${phoneNumber} (whatsappId=${whatsappId})`);
  return true;
};

/**
 * Renova o lock de líder
 * SINGLE-INSTANCE: Sempre retorna true (no-op)
 */
export const renewLeadership = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  return true;
};

/**
 * Libera o lock de líder explicitamente
 * SINGLE-INSTANCE: No-op
 */
export const releaseLeadership = async (phoneNumber: string, whatsappId: number): Promise<void> => {
  logger.debug(`[LeaderService] Single-instance: liberando líder para ${phoneNumber} (no-op)`);
};

/**
 * Retorna informações do líder atual
 * SINGLE-INSTANCE: Sempre retorna que somos o líder
 */
export const getLeaderInfo = async (phoneNumber: string): Promise<{
  isLeader: boolean;
  leaderInstanceId: string | null;
  leaderWhatsappId: number | null;
  lastSeen: number | null;
} | null> => {
  return {
    isLeader: true,
    leaderInstanceId: process.env.HOSTNAME || `instance-${process.pid}`,
    leaderWhatsappId: null,
    lastSeen: Date.now()
  };
};

/**
 * Lista todas as conexões ativas por número
 * SINGLE-INSTANCE: Retorna vazio
 */
export const listActiveLeaders = async (): Promise<Array<{
  phoneNumber: string;
  instanceId: string;
  whatsappId: number;
  lastSeen: number;
}>> => {
  return [];
};

/**
 * Gera chave do lock de líder por número
 */
export const getLeaderKey = (phoneNumber: string) => `wbot:leader:${phoneNumber}`;

/**
 * Gera ID único da instância
 */
export const getInstanceId = (): string => {
  return process.env.HOSTNAME || process.env.INSTANCE_ID || `instance-${process.pid}`;
};

export default {
  isLeader,
  isLeaderCached,
  tryBecomeLeader,
  renewLeadership,
  releaseLeadership,
  getLeaderInfo,
  listActiveLeaders,
  getLeaderKey,
  getInstanceId
};
