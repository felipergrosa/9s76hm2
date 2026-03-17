/**
 * Cache em memória para dados estáticos
 * Usado para tags, queues, users básicos que mudam raramente
 * Evita queries repetidas ao banco de dados
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number = 300000; // 5 minutos em ms

  constructor() {
    this.cache = new Map();
    
    // Limpa entradas expiradas a cada 1 minuto
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Busca valor do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verifica se expirou
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Salva valor no cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Remove valor do cache
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Remove múltiplas chaves por padrão
   */
  delPattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Verifica se chave existe e não expirou
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Cache com função de fallback
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fallback();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Limpa entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[InMemoryCache] Limpou ${cleaned} entradas expiradas`);
    }
  }

  /**
   * Limpa todo o cache
   */
  flush(): void {
    this.cache.clear();
    console.log('[InMemoryCache] Cache limpo completamente');
  }

  /**
   * Estatísticas do cache
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default new InMemoryCache();
