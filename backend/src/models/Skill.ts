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
import crypto from "crypto";
import Company from "./Company";
import AIAgent from "./AIAgent";

export type SkillCategory =
  | "communication"
  | "sales"
  | "support"
  | "crm"
  | "routing"
  | "sdr"
  | "rag"
  | "scheduling"
  | "custom";

export interface SkillTrigger {
  type: "intent" | "keyword" | "entity" | "condition";
  value: string;
  weight?: number;
}

export interface SkillExample {
  user: string;
  assistant: string;
  function?: string;
}

export interface SkillCondition {
  field: string;
  operator: "exists" | "not_exists" | "equals" | "contains" | "gt" | "lt";
  value?: any;
}

@Table({ tableName: "Skills" })
class Skill extends Model<Skill> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => AIAgent)
  @Column
  agentId: number;

  @Column
  name: string;

  @Column(DataType.ENUM(
    "communication", "sales", "support", "crm", "routing", "sdr", "rag", "scheduling", "custom"
  ))
  category: SkillCategory;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.JSONB)
  triggers: SkillTrigger[];

  @Column(DataType.JSONB)
  examples: SkillExample[];

  @Column(DataType.JSONB)
  functions: string[];

  @Column(DataType.JSONB)
  conditions: SkillCondition[];

  @Column({ defaultValue: 5 })
  priority: number;

  @Column({ defaultValue: true })
  enabled: boolean;

  @Column({ defaultValue: "1.0.0" })
  version: string;

  @Column(DataType.STRING(64))
  hash: string;

  @Column(DataType.ENUM("draft", "active", "deprecated"))
  status: "draft" | "active" | "deprecated";

  @Column(DataType.JSONB)
  metadata: {
    author?: string;
    tags?: string[];
    lastTested?: Date;
    successRate?: number;
  };

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => AIAgent)
  agent: AIAgent;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  // Calcular hash antes de salvar
  @BeforeCreate
  @BeforeUpdate
  static calculateHash(instance: Skill) {
    const content = JSON.stringify({
      name: instance.name,
      description: instance.description,
      triggers: instance.triggers,
      examples: instance.examples,
      functions: instance.functions,
      conditions: instance.conditions,
      priority: instance.priority
    });
    instance.hash = crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
  }

  // Verificar se skill mudou comparando hashes
  hasChangedFrom(otherHash: string): boolean {
    return this.hash !== otherHash;
  }

  // Incrementar versão semântica
  bumpVersion(type: "patch" | "minor" | "major" = "patch"): void {
    const [major, minor, patch] = this.version.split(".").map(Number);
    if (type === "major") {
      this.version = `${major + 1}.0.0`;
    } else if (type === "minor") {
      this.version = `${major}.${minor + 1}.0`;
    } else {
      this.version = `${major}.${minor}.${patch + 1}`;
    }
  }
}

export default Skill;
