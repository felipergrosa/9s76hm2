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
  HasMany,
  DataType
} from "sequelize-typescript";
import CampaignShipping from "./CampaignShipping";
import Company from "./Company";
import ContactList from "./ContactList";
import Whatsapp from "./Whatsapp";
import User from "./User";
import Queue from "./Queue";

@Table({ tableName: "Campaigns" })
class Campaign extends Model<Campaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column({ defaultValue: "" })
  message1: string;

  @Column({ defaultValue: "" })
  message2: string;

  @Column({ defaultValue: "" })
  message3: string;

  @Column({ defaultValue: "" })
  message4: string;

  @Column({ defaultValue: "" })
  message5: string;

  @Column({ defaultValue: "" })
  confirmationMessage1: string;

  @Column({ defaultValue: "" })
  confirmationMessage2: string;

  @Column({ defaultValue: "" })
  confirmationMessage3: string;

  @Column({ defaultValue: "" })
  confirmationMessage4: string;

  @Column({ defaultValue: "" })
  confirmationMessage5: string;

  @Column({ defaultValue: "INATIVA" })
  status: string; // INATIVA, PROGRAMADA, EM_ANDAMENTO, CANCELADA, FINALIZADA

  @Column
  confirmation: boolean;

  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @Column
  scheduledAt: Date;

  @Column
  completedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => ContactList)
  @Column
  contactListId: number;

  @BelongsTo(() => ContactList)
  contactList: ContactList;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @HasMany(() => CampaignShipping)
  shipping: CampaignShipping[];

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Column({ defaultValue: "closed" })
  statusTicket: string;

  @Column({ defaultValue: "disabled" })
  openTicket: string;

  @Column({ defaultValue: "single" })
  dispatchStrategy: string; // single | round_robin

  @Column({ type: DataType.TEXT, allowNull: true })
  allowedWhatsappIds: string; // JSON array de IDs permitidos para rodízio por campanha

  // Campos de mídia por mensagem (1..5)
  @Column
  mediaUrl1: string;

  @Column
  mediaName1: string;

  @Column
  mediaUrl2: string;

  @Column
  mediaName2: string;

  @Column
  mediaUrl3: string;

  @Column
  mediaName3: string;

  @Column
  mediaUrl4: string;

  @Column
  mediaName4: string;

  @Column
  mediaUrl5: string;

  @Column
  mediaName5: string;

  // Template oficial da Meta (API Oficial)
  @Column({ type: DataType.TEXT, allowNull: true })
  metaTemplateName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  metaTemplateLanguage: string;

  @Column({ type: DataType.JSON, allowNull: true })
  metaTemplateVariables: Record<string, any>;  // Mapeamento de variáveis do template
}

export default Campaign;
