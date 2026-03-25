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
  BelongsTo
} from "sequelize-typescript";
import AIAgent from "./AIAgent";

/**
 * Model para skills customizadas por agente
 * Permite criar, editar e desativar skills específicas para cada agente
 */
@Table({ tableName: "AIAgentSkills" })
class AIAgentSkill extends Model<AIAgentSkill> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => AIAgent)
  @Column
  agentId: number;

  @Column
  name: string;

  @Column
  category: string; // communication, sales, support, crm, routing, sdr, rag, scheduling

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.JSON)
  triggers: Array<{
    type: "intent" | "keyword" | "entity" | "condition";
    value: string;
    weight?: number;
  }>;

  @Column(DataType.JSON)
  examples: Array<{
    user: string;
    assistant: string;
    function?: string;
  }>;

  @Column(DataType.JSON)
  functions: string[];

  @Column(DataType.JSON)
  conditions: Array<{
    field: string;
    operator: "exists" | "not_exists" | "equals" | "contains" | "gt" | "lt";
    value?: any;
  }>;

  @Column
  priority: number; // 1-10

  @Column
  enabled: boolean;

  @Column(DataType.JSON)
  metadata?: {
    version?: string;
    author?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
  };

  @BelongsTo(() => AIAgent)
  agent: AIAgent;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AIAgentSkill;
