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
import User from "./User";
import Company from "./Company";

@Table
class AuditLog extends Model<AuditLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column
  userName: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  action: string; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.

  @Column
  entity: string; // User, Contact, Campaign, Ticket, etc.

  @Column
  entityId: string;

  @Column(DataType.TEXT)
  details: string; // JSON string

  @Column
  ipAddress: string;

  @Column(DataType.TEXT)
  userAgent: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AuditLog;
