/**
 * Cache em memória para avatares de contatos
 * Evita recarregamentos desnecessários e melhora performance
 */

class AvatarCache {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.TTL = 60 * 60 * 1000; // 1 hora em memória
  }

  /**
   * Gera chave única para o contato
   */
  getKey(contactId, urlPicture, profilePicUrl) {
    return `${contactId}:${urlPicture || ''}:${profilePicUrl || ''}`;
  }

  /**
   * Armazena URL do avatar no cache
   */
  set(contactId, urlPicture, profilePicUrl, avatarUrl) {
    const key = this.getKey(contactId, urlPicture, profilePicUrl);
    this.cache.set(key, {
      url: avatarUrl,
      timestamp: Date.now()
    });
  }

  /**
   * Busca URL do avatar no cache
   * Retorna null se não encontrado ou expirado
   */
  get(contactId, urlPicture, profilePicUrl) {
    const key = this.getKey(contactId, urlPicture, profilePicUrl);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Verificar expiração
    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.url;
  }

  /**
   * Pré-carrega uma URL de avatar uma única vez.
   * Útil para aquecer o cache do navegador antes da seção renderizar.
   */
  prime(url) {
    if (!url || typeof url !== "string") {
      return Promise.resolve(null);
    }

    const cleanUrl = url.trim();
    if (!cleanUrl || /^(blob|data):/i.test(cleanUrl)) {
      return Promise.resolve(cleanUrl || null);
    }

    if (this.cache.has(`prime:${cleanUrl}`)) {
      return Promise.resolve(cleanUrl);
    }

    if (this.pending.has(cleanUrl)) {
      return this.pending.get(cleanUrl);
    }

    if (typeof window === "undefined" || typeof Image === "undefined") {
      return Promise.resolve(cleanUrl);
    }

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        this.cache.set(`prime:${cleanUrl}`, {
          url: cleanUrl,
          timestamp: Date.now()
        });
        this.pending.delete(cleanUrl);
        resolve(cleanUrl);
      };
      img.onerror = () => {
        this.pending.delete(cleanUrl);
        resolve(null);
      };
      img.src = cleanUrl;
    });

    this.pending.set(cleanUrl, promise);
    return promise;
  }

  primeMany(urls = []) {
    const unique = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))];
    return Promise.all(unique.map((url) => this.prime(url)));
  }

  /**
   * Limpa cache inteiro
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove entrada específica do cache
   */
  invalidate(contactId) {
    // Remove todas as entradas deste contato
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${contactId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpa entradas expiradas (garbage collection)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Instância singleton
const avatarCache = new AvatarCache();

// Limpeza automática a cada 5 minutos
setInterval(() => {
  avatarCache.cleanup();
}, 5 * 60 * 1000);

export default avatarCache;
