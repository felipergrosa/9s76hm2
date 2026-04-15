/**
 * SkillCacheService.ts
 * 
 * Sistema de cache LRU para Skills com invalidação por hash
 * Permite hot-reload de skills sem reiniciar sessões
 */

import NodeCache from "node-cache";
import Skill from "../../models/Skill";
import logger from "../../utils/logger";

interface CachedSkillSet {
  skills: Skill[];
  hashMap: Record<number, string>; // skillId -> hash
  lastUpdated: Date;
  version: string;
}

class SkillCacheService {
  private cache: NodeCache;
  private readonly TTL_SECONDS = 300; // 5 minutos
  private readonly CHECK_PERIOD = 60; // 1 minuto

  constructor() {
    this.cache = new NodeCache({
      stdTTL: this.TTL_SECONDS,
      checkperiod: this.CHECK_PERIOD,
      useClones: false // Melhor performance, cuidado com mutações
    });

    // Eventos de expiração
    this.cache.on("expired", (key, value) => {
      logger.info(`[SkillCache] Cache expirado: ${key}`);
    });
  }

  /**
   * Gerar chave de cache
   */
  private getCacheKey(companyId: number, agentId?: number): string {
    return agentId 
      ? `skills:company:${companyId}:agent:${agentId}`
      : `skills:company:${companyId}:default`;
  }

  /**
   * Buscar skills do cache ou banco
   */
  async getSkills(
    companyId: number, 
    agentId?: number,
    forceRefresh = false
  ): Promise<Skill[]> {
    const cacheKey = this.getCacheKey(companyId, agentId);

    // Verificar cache
    if (!forceRefresh) {
      const cached = this.cache.get<CachedSkillSet>(cacheKey);
      if (cached) {
        logger.debug(`[SkillCache] Cache hit: ${cacheKey}`);
        return cached.skills;
      }
    }

    // Buscar do banco
    logger.debug(`[SkillCache] Cache miss: ${cacheKey}`);
    const skills = await this.fetchFromDatabase(companyId, agentId);
    
    // Armazenar no cache
    this.setCache(companyId, agentId, skills);
    
    return skills;
  }

  /**
   * Buscar do banco
   */
  private async fetchFromDatabase(companyId: number, agentId?: number): Promise<Skill[]> {
    const where: any = { 
      companyId, 
      enabled: true,
      status: ["active", "draft"] 
    };
    
    if (agentId) {
      where.agentId = agentId;
    }

    return await Skill.findAll({
      where,
      order: [["priority", "DESC"], ["updatedAt", "DESC"]]
    });
  }

  /**
   * Armazenar no cache com hash map
   */
  private setCache(companyId: number, agentId: number | undefined, skills: Skill[]): void {
    const cacheKey = this.getCacheKey(companyId, agentId);
    
    const hashMap: Record<number, string> = {};
    skills.forEach(skill => {
      hashMap[skill.id] = skill.hash;
    });

    const cacheData: CachedSkillSet = {
      skills,
      hashMap,
      lastUpdated: new Date(),
      version: this.generateVersion(skills)
    };

    this.cache.set(cacheKey, cacheData);
    logger.debug(`[SkillCache] Cache set: ${cacheKey} (${skills.length} skills)`);
  }

  /**
   * Verificar se há mudanças comparando hashes
   */
  async hasChanges(companyId: number, agentId?: number): Promise<boolean> {
    const cacheKey = this.getCacheKey(companyId, agentId);
    const cached = this.cache.get<CachedSkillSet>(cacheKey);

    if (!cached) {
      return true; // Sem cache = precisa atualizar
    }

    // Buscar skills atuais do banco (só hashes)
    const currentSkills = await Skill.findAll({
      where: { 
        companyId, 
        enabled: true,
        status: ["active", "draft"],
        ...(agentId && { agentId })
      },
      attributes: ["id", "hash"],
      raw: true
    });

    // Comparar tamanho
    if (currentSkills.length !== cached.skills.length) {
      return true;
    }

    // Comparar hashes
    for (const skill of currentSkills) {
      if (cached.hashMap[skill.id] !== skill.hash) {
        return true;
      }
    }

    return false;
  }

  /**
   * Invalidar cache
   */
  invalidate(companyId?: number, agentId?: number): void {
    if (companyId && agentId) {
      const key = this.getCacheKey(companyId, agentId);
      this.cache.del(key);
      logger.info(`[SkillCache] Invalidado: ${key}`);
    } else if (companyId) {
      const keys = this.cache.keys().filter(k => k.startsWith(`skills:company:${companyId}`));
      this.cache.del(keys);
      logger.info(`[SkillCache] Invalidados ${keys.length} caches da empresa ${companyId}`);
    } else {
      this.cache.flushAll();
      logger.info("[SkillCache] Todo cache invalidado");
    }
  }

  /**
   * Refresh assíncrono em background
   */
  async refreshAsync(companyId: number, agentId?: number): Promise<void> {
    try {
      const skills = await this.fetchFromDatabase(companyId, agentId);
      this.setCache(companyId, agentId, skills);
      logger.info(`[SkillCache] Refresh async completo: company=${companyId}, agent=${agentId}`);
    } catch (error) {
      logger.error("[SkillCache] Erro no refresh async:", error);
    }
  }

  /**
   * Obter estatísticas do cache
   */
  getStats(): { keys: number; hits: number; misses: number; ksize: number; vsize: number } {
    return this.cache.getStats();
  }

  /**
   * Gerar versão do skill set
   */
  private generateVersion(skills: Skill[]): string {
    const hash = skills
      .map(s => s.hash)
      .sort()
      .join("|");
    return Buffer.from(hash).toString("base64").substring(0, 16);
  }

  /**
   * Obter versão atual do cache
   */
  getCurrentVersion(companyId: number, agentId?: number): string | null {
    const cacheKey = this.getCacheKey(companyId, agentId);
    const cached = this.cache.get<CachedSkillSet>(cacheKey);
    return cached?.version || null;
  }
}

// Singleton
export const skillCache = new SkillCacheService();
export default skillCache;
