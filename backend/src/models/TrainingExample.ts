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
import Company from "./Company";
import TrainingDataset from "./TrainingDataset";

export interface TrainingMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

@Table({ tableName: "TrainingExamples" })
class TrainingExample extends Model<TrainingExample> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => TrainingDataset)
  @Column
  datasetId: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column(DataType.JSONB)
  messages: TrainingMessage[];

  @Column(DataType.JSONB)
  metadata: {
    category?: string;
    quality?: number;
    source?: string;
    agentId?: number;
    ticketId?: number;
    conversationId?: string;
    tags?: string[];
    forkedFrom?: number;
  };

  @Column(DataType.ENUM("manual", "feedback", "conversation", "import"))
  source: "manual" | "feedback" | "conversation" | "import";

  @Column
  feedbackId: number;

  @Column(DataType.FLOAT)
  quality: number;

  @Column
  tokens: number;

  @Column({ defaultValue: false })
  isVerified: boolean;

  @Column
  verifiedBy: number;

  @Column(DataType.DATE)
  verifiedAt: Date;

  @BelongsTo(() => TrainingDataset)
  dataset: TrainingDataset;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TrainingExample;
