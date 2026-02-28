/**
 * Serviço de Leader Election para múltiplas conexões do mesmo número WhatsApp
 * 
 * Este serviço coordena múltiplas conexões do mesmo número (Multi-Device WhatsApp),
 * garantindo que apenas UMA conexão processe mensagens por vez (líder).
 * 
 * Funcionamento:
 * - Cada número pode ter múltiplas conexões (DEV, PROD, etc) com QR codes separados
 * - Apenas o LÍDER processa mensagens e responde automaticamente
 * - Os FOLLOWERS recebem mensagens mas NÃO processam (apenas sincronizam histórico)
 * - Se o líder cai, outro assume automaticamente (failover)
 * 
 * Benefícios:
 * - Sem duplicação de mensagens no banco
 * - Sem conflito de respostas automáticas
 * - Histórico sincronizado entre todas as conexões
 * - Failover automático
 */

import logger from "../utils/logger";
import cacheLayer from "./cache";
import * as crypto from "crypto";

// TTL do lock de líder (30 segundos)
const LEADER_TTL_SECONDS = 30;
// Intervalo de renovação do lock (10 segundos)
const LEADER_RENEW_INTERVAL_MS = 10000;
// Tempo para considerar líder morto (60 segundos sem renovação)
const LEADER_DEAD_THRESHOLD_MS = 60000;

// Mapa local de renovação de líder por número
const leaderRenewalTimers = new Map<string, NodeJS.Timeout>();

// Mapa de status local (para verificação rápida sem Redis)
const localLeaderStatus = new Map<string, { isLeader: boolean; whatsappId: number; lastCheck: number }>();

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

/**
 * Verifica se esta conexão é o líder para o número
 * 
 * @param phoneNumber Número do WhatsApp (apenas dígitos)
 * @param whatsappId ID da conexão no banco
 * @returns true se for o líder, false caso contrário
 */
export const isLeader = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  // Validação do número
  if (!phoneNumber || phoneNumber.length < 10) {
    logger.warn(`[LeaderService] Número inválido: ${phoneNumber}`);
    return true; // Se número inválido, assume líder para não bloquear
  }

  const key = getLeaderKey(phoneNumber);
  const redis = cacheLayer.getRedisInstance();

  // Se Redis não disponível, assume líder (modo degradado)
  if (!redis) {
    logger.warn(`[LeaderService] Redis indisponível, assumindo líder para ${phoneNumber}`);
    return true;
  }

  try {
    const currentLeader = await redis.get(key);

    // Se não há líder, tentar assumir
    if (!currentLeader) {
      return await tryBecomeLeader(phoneNumber, whatsappId);
    }

    // Parse do líder atual: "instanceId:whatsappId:timestamp"
    const [instanceId, leaderWhatsappIdStr, timestampStr] = currentLeader.split(":");
    const leaderWhatsappId = parseInt(leaderWhatsappIdStr, 10);
    const timestamp = parseInt(timestampStr, 10) || 0;

    // Verificar se o líder morreu (não renova há muito tempo)
    const now = Date.now();
    if (now - timestamp > LEADER_DEAD_THRESHOLD_MS) {
      logger.warn(`[LeaderService] Líder morto detectado para ${phoneNumber}. Tentando assumir.`);
      return await tryBecomeLeader(phoneNumber, whatsappId);
    }

    // Verificar se somos o líder
    const isCurrentLeader = instanceId === getInstanceId() && leaderWhatsappId === whatsappId;

    // Atualizar cache local
    localLeaderStatus.set(phoneNumber, {
      isLeader: isCurrentLeader,
      whatsappId: leaderWhatsappId,
      lastCheck: now
    });

    return isCurrentLeader;

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao verificar líder: ${err?.message}`);
    return true; // Em caso de erro, assume líder para não bloquear
  }
};

/**
 * Tenta se tornar o líder para o número
 * 
 * @param phoneNumber Número do WhatsApp
 * @param whatsappId ID da conexão
 * @returns true se conseguiu se tornar líder
 */
export const tryBecomeLeader = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  const key = getLeaderKey(phoneNumber);
  const redis = cacheLayer.getRedisInstance();

  if (!redis) {
    return true;
  }

  const instanceId = getInstanceId();
  const now = Date.now();
  const value = `${instanceId}:${whatsappId}:${now}`;

  try {
    // Script Lua para atomicidade
    // Assume se: (a) não existe, (b) líder morto, (c) mesmo whatsappId (hot-reload)
    const script = `
      local current = redis.call("get", KEYS[1])
      if current == nil or current == false then
        -- Não há líder, assumir
        redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
        return 1
      end
      
      -- Parsear líder atual: "instanceId:whatsappId:timestamp"
      local parts = {}
      for part in string.gmatch(current, "([^:]+)") do
        table.insert(parts, part)
      end
      
      if #parts >= 3 then
        local leaderWhatsappId = parts[2]
        local timestamp = tonumber(parts[3]) or 0
        local now = tonumber(ARGV[3]) or 0
        local threshold = tonumber(ARGV[4]) or 60000
        local myWhatsappId = ARGV[5]
        
        -- Mesmo whatsappId = mesma conexão lógica (ex: hot-reload mudou PID)
        if leaderWhatsappId == myWhatsappId then
          redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
          return 3
        end
        
        if now - timestamp > threshold then
          -- Líder morto, assumir
          redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
          return 2
        end
      end
      
      -- Já existe líder ativo de outro whatsappId
      return 0
    `;

    const result = await redis.eval(
      script,
      1,
      key,
      value,
      LEADER_TTL_SECONDS,
      now,
      LEADER_DEAD_THRESHOLD_MS,
      String(whatsappId)
    );

    if (result === 1) {
      logger.info(`[LeaderService] ✅ Assumi como LÍDER para ${phoneNumber} (whatsappId=${whatsappId})`);
      startLeaderRenewal(phoneNumber, whatsappId);
      return true;
    } else if (result === 2) {
      logger.info(`[LeaderService] ✅ Assumi como LÍDER para ${phoneNumber} (líder anterior morreu)`);
      startLeaderRenewal(phoneNumber, whatsappId);
      return true;
    } else if (result === 3) {
      logger.info(`[LeaderService] ✅ Reassumi como LÍDER para ${phoneNumber} (mesmo whatsappId=${whatsappId}, novo PID)`);
      startLeaderRenewal(phoneNumber, whatsappId);
      return true;
    } else {
      logger.debug(`[LeaderService] ❌ Não sou líder para ${phoneNumber}`);
      return false;
    }

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao tentar ser líder: ${err?.message}`);
    return false;
  }
};

/**
 * Inicia renovação periódica do lock de líder
 */
const startLeaderRenewal = (phoneNumber: string, whatsappId: number) => {
  // Parar renovação anterior se existir
  stopLeaderRenewal(phoneNumber);

  const timer = setInterval(async () => {
    try {
      const renewed = await renewLeadership(phoneNumber, whatsappId);
      if (!renewed) {
        logger.warn(`[LeaderService] ❌ Perdi liderança para ${phoneNumber}. Parando renovação.`);
        stopLeaderRenewal(phoneNumber);
      }
    } catch (err: any) {
      logger.error(`[LeaderService] Erro na renovação: ${err?.message}`);
    }
  }, LEADER_RENEW_INTERVAL_MS);

  leaderRenewalTimers.set(phoneNumber, timer);

  // Atualizar cache local
  localLeaderStatus.set(phoneNumber, {
    isLeader: true,
    whatsappId,
    lastCheck: Date.now()
  });
};

/**
 * Para renovação do lock de líder
 */
const stopLeaderRenewal = (phoneNumber: string) => {
  const timer = leaderRenewalTimers.get(phoneNumber);
  if (timer) {
    clearInterval(timer);
    leaderRenewalTimers.delete(phoneNumber);
  }

  // Atualizar cache local
  const current = localLeaderStatus.get(phoneNumber);
  if (current) {
    localLeaderStatus.set(phoneNumber, {
      ...current,
      isLeader: false,
      lastCheck: Date.now()
    });
  }
};

/**
 * Renova o lock de líder
 */
export const renewLeadership = async (phoneNumber: string, whatsappId: number): Promise<boolean> => {
  const key = getLeaderKey(phoneNumber);
  const redis = cacheLayer.getRedisInstance();

  if (!redis) {
    return true;
  }

  const instanceId = getInstanceId();
  const now = Date.now();
  const value = `${instanceId}:${whatsappId}:${now}`;

  try {
    // Script Lua: só renova se ainda somos o dono
    const script = `
      local current = redis.call("get", KEYS[1])
      if current == nil then
        -- Lock expirou, recriar
        redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
        return 1
      end
      
      local parts = {}
      for part in string.gmatch(current, "([^:]+)") do
        table.insert(parts, part)
      end
      
      if #parts >= 2 then
        local instanceId = parts[1]
        local whatsappId = parts[2]
        
        if instanceId == ARGV[3] and whatsappId == ARGV[4] then
          -- Somos o dono, renovar
          redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
          return 1
        end
      end
      
      -- Não somos o dono
      return 0
    `;

    const result = await redis.eval(
      script,
      1,
      key,
      value,
      LEADER_TTL_SECONDS,
      instanceId,
      String(whatsappId)
    );

    if (result === 1) {
      // logger.debug(`[LeaderService] Liderança renovada para ${phoneNumber}`);
      return true;
    } else {
      logger.warn(`[LeaderService] ❌ Não consegui renovar liderança para ${phoneNumber}`);
      return false;
    }

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao renovar: ${err?.message}`);
    return false;
  }
};

/**
 * Libera o lock de líder explicitamente (ao desconectar)
 */
export const releaseLeadership = async (phoneNumber: string, whatsappId: number): Promise<void> => {
  const key = getLeaderKey(phoneNumber);
  const redis = cacheLayer.getRedisInstance();

  // Parar renovação
  stopLeaderRenewal(phoneNumber);

  if (!redis) {
    return;
  }

  try {
    // Script Lua: só libera se somos o dono
    const script = `
      local current = redis.call("get", KEYS[1])
      if current == nil then
        return 0
      end
      
      local parts = {}
      for part in string.gmatch(current, "([^:]+)") do
        table.insert(parts, part)
      end
      
      if #parts >= 2 then
        local instanceId = parts[1]
        local whatsappId = parts[2]
        
        if instanceId == ARGV[1] and whatsappId == ARGV[2] then
          -- Somos o dono, liberar
          redis.call("del", KEYS[1])
          return 1
        end
      end
      
      -- Não somos o dono
      return 0
    `;

    const result = await redis.eval(script, 1, key, getInstanceId(), String(whatsappId));

    if (result === 1) {
      logger.info(`[LeaderService] ✅ Liberei liderança para ${phoneNumber}`);
    }

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao liberar liderança: ${err?.message}`);
  }
};

/**
 * Retorna informações do líder atual para um número
 */
export const getLeaderInfo = async (phoneNumber: string): Promise<{
  isLeader: boolean;
  leaderInstanceId: string | null;
  leaderWhatsappId: number | null;
  lastSeen: number | null;
} | null> => {
  const key = getLeaderKey(phoneNumber);
  const redis = cacheLayer.getRedisInstance();

  if (!redis) {
    return null;
  }

  try {
    const current = await redis.get(key);

    if (!current) {
      return {
        isLeader: false,
        leaderInstanceId: null,
        leaderWhatsappId: null,
        lastSeen: null
      };
    }

    const [instanceId, whatsappIdStr, timestampStr] = current.split(":");
    const whatsappId = parseInt(whatsappIdStr, 10) || null;
    const timestamp = parseInt(timestampStr, 10) || null;

    return {
      isLeader: instanceId === getInstanceId(),
      leaderInstanceId: instanceId,
      leaderWhatsappId: whatsappId,
      lastSeen: timestamp
    };

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao obter info do líder: ${err?.message}`);
    return null;
  }
};

/**
 * Verificação rápida local (sem Redis) para cache
 * Útil para evitar chamadas Redis a cada mensagem
 */
export const isLeaderCached = (phoneNumber: string): boolean => {
  const cached = localLeaderStatus.get(phoneNumber);

  if (!cached) {
    return true; // Se não há cache, assume líder
  }

  // Cache válido por 5 segundos
  const cacheAge = Date.now() - cached.lastCheck;
  if (cacheAge > 5000) {
    return true; // Cache expirado, assume líder (será verificado no próximo ciclo)
  }

  return cached.isLeader;
};

/**
 * Lista todas as conexões ativas por número (para debug)
 */
export const listActiveLeaders = async (): Promise<Array<{
  phoneNumber: string;
  instanceId: string;
  whatsappId: number;
  lastSeen: number;
}>> => {
  const redis = cacheLayer.getRedisInstance();

  if (!redis) {
    return [];
  }

  try {
    const keys = await redis.keys("wbot:leader:*");
    const results: Array<{
      phoneNumber: string;
      instanceId: string;
      whatsappId: number;
      lastSeen: number;
    }> = [];

    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        const phoneNumber = key.replace("wbot:leader:", "");
        const [instanceId, whatsappIdStr, timestampStr] = value.split(":");
        results.push({
          phoneNumber,
          instanceId,
          whatsappId: parseInt(whatsappIdStr, 10) || 0,
          lastSeen: parseInt(timestampStr, 10) || 0
        });
      }
    }

    return results;

  } catch (err: any) {
    logger.error(`[LeaderService] Erro ao listar líderes: ${err?.message}`);
    return [];
  }
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
