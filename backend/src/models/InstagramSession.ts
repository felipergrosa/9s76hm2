import { Table, Column, CreatedAt, UpdatedAt, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import Company from "./Company";

@Table
class InstagramSession extends Model<InstagramSession> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Company)
  @Column({ unique: true })
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING)
  username: string;

  @Column({ type: DataType.JSON, defaultValue: [] })
  cookies: object[];

  @Column({ type: DataType.STRING, defaultValue: "active" })
  status: "active" | "expired" | "banned";

  @Column(DataType.DATE)
  lastLoginAt: Date;

  @Column(DataType.DATE)
  lastUsedAt: Date;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default InstagramSession;
