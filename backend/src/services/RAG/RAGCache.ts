/**
 * Cache Redis para embeddings
 * Reduz custo de API e latência para queries frequentes
 * 
 * Requer: npm install redis
 * Se não instalado, funciona sem cache (fallback)
 */

import { embedTexts } from "./EmbeddingService";

// eslint-disable-next-line @typescript-eslint/no-var-requires
let RedisModule: any = null;
try {
  RedisModule = require('redis');
} catch {
  console.log('[RAGCache] Redis module not installed, cache disabled. Run: npm install redis');
}

type RedisClientType = any;

let redisClient: RedisClientType | null = null;
let redisConnected = false;

/**
 * Inicializa conexão Redis (lazy)
 */
const getRedisClient = async (): Promise<RedisClientType | null> => {
  if (redisClient && redisConnected) {
    return redisClient;
  }

  // Verifica se Redis está configurado e módulo disponível
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  if (!redisUrl || !RedisModule) {
    return null;
  }

  try {
    const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    redisClient = RedisModule.createClient({ url });
    
    redisClient.on('error', (err: any) => {
      console.error('[RAGCache] Redis error:', err.message);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[RAGCache] Redis connected');
      redisConnected = true;
    });

    await redisClient.connect();
    redisConnected = true;
    
    return redisClient;
  } catch (error: any) {
    console.warn('[RAGCache] Redis connection failed:', error.message);
    return null;
  }
};

/**
 * Gera hash para texto (para usar como chave de cache)
 */
const hashText = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Gera chave de cache para embedding
 */
const getCacheKey = (companyId: number, text: string, model?: string): string => {
  const textHash = hashText(text);
  const modelSuffix = model || 'default';
  return `rag:emb:${companyId}:${modelSuffix}:${textHash}`;
};

/**
 * Busca embedding do cache ou gera novo
 */
export const getEmbeddingWithCache = async (
  companyId: number,
  text: string,
  model?: string,
  ttlSeconds: number = 3600 // 1 hora default
): Promise<number[]> => {
  const client = await getRedisClient();

  // Se não tem Redis, gera direto
  if (!client) {
    const [embedding] = await embedTexts(companyId, [text], { model });
    return embedding;
  }

  const cacheKey = getCacheKey(companyId, text, model);

  try {
    // Tenta buscar do cache
    const cached = await client.get(cacheKey);
    
    if (cached) {
      console.log(`[RAGCache] Cache HIT for key: ${cacheKey.slice(0, 30)}...`);
      return JSON.parse(cached);
    }

    console.log(`[RAGCache] Cache MISS for key: ${cacheKey.slice(0, 30)}...`);

    // Gera novo embedding
    const [embedding] = await embedTexts(companyId, [text], { model });

    // Salva no cache
    await client.setEx(cacheKey, ttlSeconds, JSON.stringify(embedding));

    return embedding;
  } catch (error: any) {
    console.warn('[RAGCache] Cache error:', error.message);
    // Fallback: gera sem cache
    const [embedding] = await embedTexts(companyId, [text], { model });
    return embedding;
  }
};

/**
 * Busca múltiplos embeddings com cache
 */
export const getEmbeddingsWithCache = async (
  companyId: number,
  texts: string[],
  model?: string,
  ttlSeconds: number = 3600
): Promise<number[][]> => {
  const client = await getRedisClient();

  // Se não tem Redis, gera direto
  if (!client) {
    return await embedTexts(companyId, texts, { model });
  }

  const results: number[][] = new Array(texts.length);
  const toGenerate: { index: number; text: string }[] = [];

  // Busca todos do cache em paralelo
  const cacheKeys = texts.map((t, i) => ({ key: getCacheKey(companyId, t, model), index: i }));

  try {
    const cachedResults = await Promise.all(
      cacheKeys.map(async ({ key, index }) => {
        const cached = await client.get(key);
        return { index, cached, key };
      })
    );

    // Processa resultados
    for (const { index, cached, key } of cachedResults) {
      if (cached) {
        results[index] = JSON.parse(cached);
      } else {
        toGenerate.push({ index, text: texts[index] });
      }
    }

    console.log(`[RAGCache] Cache hits: ${results.filter(Boolean).length}/${texts.length}`);

    // Gera embeddings que não estavam no cache
    if (toGenerate.length > 0) {
      const newEmbeddings = await embedTexts(
        companyId,
        toGenerate.map(t => t.text),
        { model }
      );

      // Salva no cache e adiciona aos resultados
      for (let i = 0; i < toGenerate.length; i++) {
        const { index } = toGenerate[i];
        results[index] = newEmbeddings[i];

        const cacheKey = getCacheKey(companyId, toGenerate[i].text, model);
        await client.setEx(cacheKey, ttlSeconds, JSON.stringify(newEmbeddings[i]));
      }
    }

    return results;
  } catch (error: any) {
    console.warn('[RAGCache] Batch cache error:', error.message);
    // Fallback: gera todos sem cache
    return await embedTexts(companyId, texts, { model });
  }
};

/**
 * Invalida cache para uma empresa
 */
export const invalidateCompanyCache = async (companyId: number): Promise<void> => {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const pattern = `rag:emb:${companyId}:*`;
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`[RAGCache] Invalidated ${keys.length} cache keys for company ${companyId}`);
    }
  } catch (error: any) {
    console.warn('[RAGCache] Cache invalidation error:', error.message);
  }
};

/**
 * Estatísticas do cache
 */
export const getCacheStats = async (): Promise<{
  connected: boolean;
  keys?: number;
  memory?: string;
}> => {
  const client = await getRedisClient();
  
  if (!client) {
    return { connected: false };
  }

  try {
    const dbSize = await client.dbSize();
    const info = await client.info('memory');
    const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || 'unknown';

    return {
      connected: true,
      keys: dbSize,
      memory: usedMemory
    };
  } catch {
    return { connected: redisConnected };
  }
};

export default {
  getEmbeddingWithCache,
  getEmbeddingsWithCache,
  invalidateCompanyCache,
  getCacheStats
};
