/**
 * FeatureFlagService.ts
 * 
 * Serviço de Feature Flags para rollout gradual de funcionalidades
 * Suporta: boolean, percentage, user_segment, gradual rollouts
 * Experiments A/B integrados
 */

import FeatureFlag from "../../models/FeatureFlag";
import NodeCache from "node-cache";
import logger from "../../utils/logger";

interface EvaluationContext {
  companyId: number;
  userId?: number;
  agentId?: number;
  queueId?: number;
  contactId?: number;
  whatsappId?: number;
  userGroup?: string;
  plan?: string;
  region?: string;
  [key: string]: any;
}

interface EvaluationResult {
  enabled: boolean;
  flag?: FeatureFlag;
  group?: "control" | "treatment";
  reason: string;
}

class FeatureFlagService {
  private cache: NodeCache;
  private readonly TTL_SECONDS = 60; // Cache de 1 minuto

  constructor() {
    this.cache = new NodeCache({
      stdTTL: this.TTL_SECONDS,
      checkperiod: 30
    });

    this.cache.on("expired", (key) => {
      logger.debug(`[FeatureFlag] Cache expirado: ${key}`);
    });
  }

  /**
   * Avaliar se uma feature flag está habilitada para o contexto
   */
  async isEnabled(key: string, context: EvaluationContext): Promise<boolean> {
    const result = await this.evaluate(key, context);
    return result.enabled;
  }

  /**
   * Avaliar feature flag com detalhes completos
   */
  async evaluate(key: string, context: EvaluationContext): Promise<EvaluationResult> {
    const cacheKey = `flag:${context.companyId}:${key}`;
    let flag = this.cache.get<FeatureFlag>(cacheKey);

    // Buscar do banco se não estiver em cache
    if (!flag) {
      flag = await FeatureFlag.findOne({
        where: { key, companyId: context.companyId }
      });

      if (flag) {
        this.cache.set(cacheKey, flag);
      }
    }

    // Flag não existe = desabilitada
    if (!flag) {
      return { enabled: false, reason: "flag_not_found" };
    }

    // Verificar dependências primeiro
    const depsSatisfied = await this.checkDependencies(flag, context);
    if (!depsSatisfied) {
      flag.incrementMetric("disabledCount");
      return { enabled: false, flag, reason: "dependencies_not_satisfied" };
    }

    // Avaliar flag
    const enabled = flag.isEnabledFor(context);
    
    // Registrar métricas
    flag.incrementMetric("impressions");
    if (enabled) {
      flag.incrementMetric("enabledCount");
    } else {
      flag.incrementMetric("disabledCount");
    }

    // Salvar métricas periodicamente (não await para não bloquear)
    if ((flag.metrics?.impressions || 0) % 100 === 0) {
      flag.update({ metrics: flag.metrics }).catch(err => {
        logger.error("[FeatureFlag] Erro ao salvar métricas:", err);
      });
    }

    // Verificar se é experimento
    if (enabled && flag.isExperimentActive()) {
      const group = flag.getExperimentGroup({ userId: context.userId });
      return { enabled: true, flag, group, reason: "experiment" };
    }

    return { 
      enabled, 
      flag, 
      reason: enabled ? flag.rolloutType : "targeting_rules"
    };
  }

  /**
   * Verificar dependências de outras flags
   */
  private async checkDependencies(flag: FeatureFlag, context: EvaluationContext): Promise<boolean> {
    if (!flag.dependencies || flag.dependencies.length === 0) {
      return true;
    }

    for (const depKey of flag.dependencies) {
      const depEnabled = await this.isEnabled(depKey, context);
      if (!depEnabled) {
        return false;
      }
    }

    return true;
  }

  /**
   * Criar nova feature flag
   */
  async createFlag(data: {
    companyId: number;
    name: string;
    key: string;
    description?: string;
    rolloutType?: string;
    enabled?: boolean;
    percentage?: number;
    segments?: number[];
    targetEntities?: any;
    targetingRules?: any;
    experiment?: any;
    dependencies?: string[];
    createdBy?: number;
  }): Promise<FeatureFlag> {
    // Verificar se chave já existe
    const existing = await FeatureFlag.findOne({
      where: { key: data.key, companyId: data.companyId }
    });

    if (existing) {
      throw new Error(`Feature flag '${data.key}' já existe`);
    }

    const flag = await FeatureFlag.create({
      ...data,
      status: "draft",
      metadata: {
        createdBy: data.createdBy,
        lastModifiedBy: data.createdBy,
        notes: ""
      }
    });

    logger.info(`[FeatureFlag] Criada: ${data.key} na empresa ${data.companyId}`);
    return flag;
  }

  /**
   * Atualizar feature flag
   */
  async updateFlag(
    flagId: number, 
    updates: Partial<FeatureFlag>,
    modifiedBy?: number
  ): Promise<FeatureFlag> {
    const flag = await FeatureFlag.findByPk(flagId);
    
    if (!flag) {
      throw new Error("Feature flag não encontrada");
    }

    await flag.update({
      ...updates,
      metadata: {
        ...flag.metadata,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: new Date().toISOString()
      }
    });

    // Invalidar cache
    this.invalidateCache(flag.companyId, flag.key);

    logger.info(`[FeatureFlag] Atualizada: ${flag.key}`);
    return flag;
  }

  /**
   * Gradual rollout - aumentar porcentagem automaticamente
   */
  async gradualRollout(
    flagId: number,
    steps: number[] = [10, 25, 50, 75, 100],
    stepDurationMinutes = 30
  ): Promise<void> {
    const flag = await FeatureFlag.findByPk(flagId);
    if (!flag) throw new Error("Flag não encontrada");

    let currentStep = 0;
    
    const rollout = async () => {
      if (currentStep >= steps.length) {
        logger.info(`[FeatureFlag] Rollout completo: ${flag.key}`);
        return;
      }

      const percentage = steps[currentStep];
      await flag.update({ percentage });
      this.invalidateCache(flag.companyId, flag.key);

      logger.info(`[FeatureFlag] Rollout ${flag.key}: ${percentage}%`);

      currentStep++;
      if (currentStep < steps.length) {
        setTimeout(rollout, stepDurationMinutes * 60 * 1000);
      }
    };

    rollout();
  }

  /**
   * Listar todas as flags de uma empresa
   */
  async listFlags(companyId: number, filters?: { enabled?: boolean }): Promise<FeatureFlag[]> {
    const where: any = { companyId };
    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    return await FeatureFlag.findAll({
      where,
      order: [["updatedAt", "DESC"]]
    });
  }

  /**
   * Deletar flag
   */
  async deleteFlag(flagId: number): Promise<void> {
    const flag = await FeatureFlag.findByPk(flagId);
    if (!flag) throw new Error("Flag não encontrada");

    const { companyId, key } = flag;
    await flag.destroy();
    
    this.invalidateCache(companyId, key);
    logger.info(`[FeatureFlag] Deletada: ${key}`);
  }

  /**
   * Obter estatísticas de uso
   */
  async getStats(companyId: number): Promise<any> {
    const flags = await FeatureFlag.findAll({ where: { companyId } });
    
    return {
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      byType: {
        boolean: flags.filter(f => f.rolloutType === "boolean").length,
        percentage: flags.filter(f => f.rolloutType === "percentage").length,
        user_segment: flags.filter(f => f.rolloutType === "user_segment").length,
        gradual: flags.filter(f => f.rolloutType === "gradual").length
      },
      experiments: flags.filter(f => f.experiment?.isExperiment).length,
      totalImpressions: flags.reduce((sum, f) => sum + (f.metrics?.impressions || 0), 0)
    };
  }

  /**
   * Invalidar cache
   */
  invalidateCache(companyId?: number, key?: string): void {
    if (key && companyId) {
      this.cache.del(`flag:${companyId}:${key}`);
    } else if (companyId) {
      const keys = this.cache.keys().filter(k => k.startsWith(`flag:${companyId}:`));
      this.cache.del(keys);
    } else {
      this.cache.flushAll();
    }
  }
}

// Singleton
export const featureFlagService = new FeatureFlagService();
export default featureFlagService;
