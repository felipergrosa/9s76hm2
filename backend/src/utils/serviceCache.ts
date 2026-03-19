/**
 * Cache em memória para services pesados
 * Evita queries repetidas durante carregamento inicial de /tickets
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ServiceCache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_SIZE = 500; // Limite máximo de entradas

  constructor() {
    this.cache = new Map();
    
    // Garbage collection a cada 2 minutos
    setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);
  }

  /**
   * Busca valor no cache
   */
  get<T>(key: string, ttl: number = this.DEFAULT_TTL): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Armazena valor no cache
   */
  set<T>(key: string, data: T): void {
    // LRU: Se cache está cheio, remover entrada mais antiga
    if (this.cache.size >= this.MAX_SIZE && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalida entrada específica
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalida por padrão (regex)
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpa cache inteiro
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.DEFAULT_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instância singleton
export const serviceCache = new ServiceCache();

/**
 * Helper para cachear resultado de função
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Buscar cache
  const cached = serviceCache.get<T>(key, ttl);
  if (cached !== null) {
    return cached;
  }

  // Executar função
  const result = await fn();
  
  // Armazenar no cache
  serviceCache.set(key, result);
  
  return result;
}

export default serviceCache;
