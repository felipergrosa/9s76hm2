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

@Table({ tableName: "ConversationSummaries" })
class ConversationSummary extends Model<ConversationSummary> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  contactId: number;

  @Column
  ticketId: number;

  @Column(DataType.TEXT)
  summary: string;

  @Column(DataType.JSONB)
  keyPoints: string[];

  @Column(DataType.ENUM("positive", "neutral", "negative"))
  sentiment: "positive" | "neutral" | "negative";

  @Column(DataType.JSONB)
  topics: string[];

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ConversationSummary;
