import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Campaign from "./Campaign";
import ContactListItem from "./ContactListItem";

@Table({ tableName: "CampaignShipping" })
class CampaignShipping extends Model<CampaignShipping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  jobId: string;

  @Column
  number: string;

  @Column
  message: string;

  @Column
  confirmationMessage: string;

  @Column
  confirmation: boolean;

  @ForeignKey(() => ContactListItem)
  @Column
  contactId: number;

  @ForeignKey(() => Campaign)
  @Column
  campaignId: number;

  @Column
  confirmationRequestedAt: Date;

  @Column
  confirmedAt: Date;

  @Column
  deliveredAt: Date;

  // Índice da mensagem escolhida (1..5) para suportar mídia por mensagem
  @Column
  messageIndex: number;

  // Campos de monitoramento e rastreamento de erros
  @Column({ defaultValue: 0 })
  attempts: number;

  @Column
  lastError: string;

  @Column
  lastErrorAt: Date;

  @Column({ defaultValue: "pending" })
  status: string; // pending, processing, delivered, failed, suppressed

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => ContactListItem)
  contact: ContactListItem;

  @BelongsTo(() => Campaign)
  campaign: Campaign;
}

export default CampaignShipping;
