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
  DataType
} from "sequelize-typescript";
import EmailCampaign from "./EmailCampaign";
import ContactListItem from "./ContactListItem";

@Table({ tableName: "EmailShippings" })
class EmailShipping extends Model<EmailShipping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  jobId: string;

  @Column
  email: string;

  @Column
  subject: string;

  @Column(DataType.TEXT)
  message: string;

  @ForeignKey(() => ContactListItem)
  @Column
  contactId: number;

  @BelongsTo(() => ContactListItem)
  contact: ContactListItem;

  @ForeignKey(() => EmailCampaign)
  @Column
  emailCampaignId: number;

  @BelongsTo(() => EmailCampaign)
  emailCampaign: EmailCampaign;

  @Column({ defaultValue: 0 })
  attempts: number;

  @Column(DataType.TEXT)
  lastError: string;

  @Column
  lastErrorAt: Date;

  @Column
  deliveredAt: Date;

  @Column({ defaultValue: "pending" })
  status: string; // pending, processing, delivered, failed

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default EmailShipping;
