import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  BeforeCreate,
  BeforeUpdate
} from "sequelize-typescript";
import Company from "./Company";

export type RolloutType = "boolean" | "percentage" | "user_segment" | "gradual";

export interface FeatureFlagMetrics {
  impressions: number;
  enabledCount: number;
  disabledCount: number;
  errorCount: number;
  lastError?: string;
  lastErrorAt?: Date;
}

export interface FeatureFlagTargetEntities {
  agentIds?: number[];
  queueIds?: number[];
  contactIds?: number[];
  whatsappIds?: number[];
}

export interface FeatureFlagTargetingRules {
  userGroups?: string[];
  plans?: string[];
  regions?: string[];
  custom?: Record<string, any>;
}

export interface FeatureFlagExperiment {
  isExperiment: boolean;
  controlGroupPercentage: number;
  treatmentGroupPercentage: number;
  startDate?: Date;
  endDate?: Date;
  winner?: "control" | "treatment" | null;
  metrics?: {
    control: Record<string, number>;
    treatment: Record<string, number>;
  };
}

@Table({ tableName: "FeatureFlags" })
class FeatureFlag extends Model<FeatureFlag> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  name: string;

  @Column
  key: string;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.ENUM("boolean", "percentage", "user_segment", "gradual"))
  rolloutType: RolloutType;

  @Column({ defaultValue: false })
  enabled: boolean;

  @Column({ defaultValue: 0 })
  percentage: number;

  @Column(DataType.JSONB)
  segments: number[]; // userIds

  @Column(DataType.JSONB)
  targetEntities: FeatureFlagTargetEntities;

  @Column(DataType.JSONB)
  targetingRules: FeatureFlagTargetingRules;

  @Column(DataType.JSONB)
  metrics: FeatureFlagMetrics;

  @Column(DataType.JSONB)
  experiment: FeatureFlagExperiment;

  @Column(DataType.JSONB)
  dependencies: string[]; // keys de outras flags

  @Column(DataType.JSONB)
  metadata: {
    createdBy?: number;
    lastModifiedBy?: number;
    notes?: string;
  };

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  // Validações
  @BeforeCreate
  @BeforeUpdate
  static validatePercentage(instance: FeatureFlag): void {
    if (instance.percentage < 0) instance.percentage = 0;
    if (instance.percentage > 100) instance.percentage = 100;
  }

  // Métodos de instância

  /**
   * Verificar se flag está habilitada para um contexto específico
   */
  isEnabledFor(context: {
    userId?: number;
    agentId?: number;
    queueId?: number;
    contactId?: number;
    whatsappId?: number;
    userGroup?: string;
    plan?: string;
    region?: string;
  }): boolean {
    // Se flag está desabilitada globalmente
    if (!this.enabled) {
      return false;
    }

    // Verificar dependências primeiro
    // (deve ser verificado externamente via FeatureFlagService)

    // Boolean simples
    if (this.rolloutType === "boolean") {
      return true;
    }

    // Percentage-based
    if (this.rolloutType === "percentage") {
      // Usar consistent hashing para manter mesma experiência por user
      const hash = this.hashContext(context);
      return (hash % 100) < this.percentage;
    }

    // User segment
    if (this.rolloutType === "user_segment") {
      if (context.userId && this.segments?.includes(context.userId)) {
        return true;
      }
      return false;
    }

    // Gradual rollout (combina percentage + targeting rules)
    if (this.rolloutType === "gradual") {
      // Verificar targeting rules primeiro
      if (this.matchesTargetingRules(context)) {
        // Aplicar percentage dentro do target
        const hash = this.hashContext(context);
        return (hash % 100) < this.percentage;
      }
      return false;
    }

    return false;
  }

  /**
   * Verificar se contexto atende targeting rules
   */
  private matchesTargetingRules(context: any): boolean {
    const rules = this.targetingRules || {};

    if (rules.userGroups?.length > 0) {
      if (!context.userGroup || !rules.userGroups.includes(context.userGroup)) {
        return false;
      }
    }

    if (rules.plans?.length > 0) {
      if (!context.plan || !rules.plans.includes(context.plan)) {
        return false;
      }
    }

    if (rules.regions?.length > 0) {
      if (!context.region || !rules.regions.includes(context.region)) {
        return false;
      }
    }

    // Verificar target entities
    const targets = this.targetEntities || {};
    
    if (targets.agentIds?.length > 0) {
      if (!context.agentId || !targets.agentIds.includes(context.agentId)) {
        return false;
      }
    }

    if (targets.queueIds?.length > 0) {
      if (!context.queueId || !targets.queueIds.includes(context.queueId)) {
        return false;
      }
    }

    if (targets.contactIds?.length > 0) {
      if (!context.contactId || !targets.contactIds.includes(context.contactId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Hash consistente de contexto para percentage rollout
   */
  private hashContext(context: any): number {
    // Criar string determinística do contexto
    const str = JSON.stringify({
      flagKey: this.key,
      companyId: this.companyId,
      userId: context.userId,
      agentId: context.agentId,
      contactId: context.contactId
    });

    // Simple hash algorithm (FNV-1a inspired)
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash % 10000) / 100; // 0-100
  }

  /**
   * Incrementar métricas
   */
  incrementMetric(metric: keyof FeatureFlagMetrics, value = 1): void {
    if (!this.metrics) {
      this.metrics = { impressions: 0, enabledCount: 0, disabledCount: 0, errorCount: 0 };
    }
    const current = this.metrics[metric] as number || 0;
    (this.metrics[metric] as number) = current + value;
  }

  /**
   * Verificar se está em período de experimento
   */
  isExperimentActive(): boolean {
    if (!this.experiment?.isExperiment) return false;
    
    const now = new Date();
    const start = this.experiment.startDate ? new Date(this.experiment.startDate) : null;
    const end = this.experiment.endDate ? new Date(this.experiment.endDate) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
  }

  /**
   * Determinar grupo de experimento
   */
  getExperimentGroup(context: { userId?: number }): "control" | "treatment" | null {
    if (!this.isExperimentActive()) return null;

    const hash = this.hashContext(context);
    return hash < (this.experiment?.controlGroupPercentage || 50) ? "control" : "treatment";
  }
}

export default FeatureFlag;
