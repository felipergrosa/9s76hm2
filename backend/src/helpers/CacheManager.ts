import Redis from "ioredis";

class CacheManager {
  private redis: Redis;
  private defaultTTL: number = 300; // 5 minutos

  constructor() {
    this.redis = new Redis({
      host: process.env.IO_REDIS_SERVER || "localhost",
      port: parseInt(process.env.IO_REDIS_PORT || "6379"),
      password: process.env.IO_REDIS_PASSWORD || undefined,
      db: parseInt(process.env.IO_REDIS_DB_CACHE || "1"), // DB separado para cache
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on("error", (err) => {
      console.error("[CacheManager] Redis error:", err);
    });
  }

  /**
   * Busca valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[CacheManager] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Salva valor no cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      await this.redis.setex(key, expiry, serialized);
      return true;
    } catch (error) {
      console.error(`[CacheManager] Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove valor do cache
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`[CacheManager] Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove múltiplas chaves por padrão
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error(`[CacheManager] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Verifica se chave existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[CacheManager] Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Incrementa contador
   */
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      if (ttl && value === 1) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error(`[CacheManager] Error incrementing key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Cache com função de fallback
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fallback();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Limpa todo o cache (use com cuidado!)
   */
  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error("[CacheManager] Error flushing cache:", error);
      return false;
    }
  }

  /**
   * Estatísticas do cache
   */
  async stats(): Promise<any> {
    try {
      const info = await this.redis.info("stats");
      const memory = await this.redis.info("memory");
      return { info, memory };
    } catch (error) {
      console.error("[CacheManager] Error getting stats:", error);
      return null;
    }
  }
}

export default new CacheManager();
