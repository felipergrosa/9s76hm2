import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default
} from "sequelize-typescript";

import Company from "./Company";
import Contact from "./Contact";
import User from "./User";

@Table
class ContactReleaseRequest extends Model<ContactReleaseRequest> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => User)
  @Column
  requesterId: number;

  @BelongsTo(() => User, "requesterId")
  requester: User;

  @Default("pending")
  @Column(DataType.STRING)
  status: "pending" | "resolved";

  @Column(DataType.TEXT)
  reason: string;

  @ForeignKey(() => User)
  @Column
  resolvedById: number;

  @BelongsTo(() => User, "resolvedById")
  resolvedBy: User;

  @Column
  resolvedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactReleaseRequest;
