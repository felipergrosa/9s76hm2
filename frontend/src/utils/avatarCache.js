/**
 * Cache em memória para avatares de contatos
 * Evita recarregamentos desnecessários e melhora performance
 */

class AvatarCache {
  constructor() {
    this.cache = new Map();
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
