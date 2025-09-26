import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
  DataType,
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";

@Table
class Prompt extends Model<Prompt> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  prompt: string;

  @AllowNull(false)
  @Column
  apiKey: string;

  maxMessages: number;

  @Column({ defaultValue: 100 })
  maxTokens: number;

  @Column({ type: DataType.FLOAT, defaultValue: 0.9 })
  temperature: number;

  @Column({ defaultValue: 0 })
  promptTokens: number;
  completionTokens: number;

  @Column({ defaultValue: 0 })
  totalTokens: number;

  @AllowNull(false)
  @Column
  voice: string;

  @AllowNull(true)
  @Column
  voiceKey: string;

  @AllowNull(true)
  @Column
  voiceRegion: string;

  @AllowNull(false)
  @Column
  model: string; // Added model as a STRING column

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  attachments: string; // JSON string com anexos selecionados na biblioteca

  @AllowNull
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @AllowNull(true)
  @Column
  integrationId: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Prompt;