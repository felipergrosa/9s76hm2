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
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import AIAgent from "./AIAgent";
import TrainingExample from "./TrainingExample";

export interface DatasetStats {
  totalExamples: number;
  totalTokens: number;
  avgQuality: number;
  categories: Record<string, number>;
}

@Table({ tableName: "TrainingDatasets" })
class TrainingDataset extends Model<TrainingDataset> {
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

  @Column(DataType.TEXT)
  description: string;

  @Column({ defaultValue: "1.0.0" })
  version: string;

  @Column(DataType.ENUM("openai", "anthropic", "gemini", "llama", "generic"))
  format: "openai" | "anthropic" | "gemini" | "llama" | "generic";

  @Column(DataType.JSONB)
  stats: DatasetStats;

  @Column(DataType.JSONB)
  metadata: {
    createdBy?: number;
    source?: string;
    tags?: string[];
    notes?: string;
    forkedFrom?: number;
    forkedAt?: string;
    forkedBy?: number;
  };

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => AIAgent)
  agent: AIAgent;

  @HasMany(() => TrainingExample)
  examples: TrainingExample[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TrainingDataset;
