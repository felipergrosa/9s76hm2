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

@Table({ tableName: "AIMemories" })
class AIMemory extends Model<AIMemory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  contactId: number;

  @Column(DataType.ENUM("fact", "preference", "summary", "context"))
  type: "fact" | "preference" | "summary" | "context";

  @Column
  key: string;

  @Column(DataType.TEXT)
  value: string;

  @Column(DataType.FLOAT)
  confidence: number;

  @Column
  sourceTicketId: number;

  @Column
  sourceConversationId: string;

  @Column(DataType.DATE)
  expiresAt: Date;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AIMemory;
