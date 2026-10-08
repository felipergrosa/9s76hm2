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

  // Recorrência do disparo: none | daily | weekly | monthly
  @Column({ defaultValue: "none" })
  recurrence: string;

  // Data limite da recorrência (null = repete indefinidamente)
  @Column({ type: DataType.DATE, allowNull: true })
  recurrenceEndAt: Date;

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

  @Column({ type: DataType.TEXT, allowNull: true })
  contactListIds: string; // JSON array de IDs de listas conjugadas

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

  @Column({ type: DataType.TEXT, allowNull: true })
  userIds: string; // JSON array de IDs de usuários para distribuição por tags

  // Tag para filtrar contatos
  @Column({ type: DataType.INTEGER, allowNull: true })
  tagListId: number;

  // Tags para excluir contatos da campanha
  @Column({ type: DataType.TEXT, allowNull: true })
  negativeTagListIds: string;

  // Tag de controle: aplicada ao contato no disparo e removida quando ele
  // responde (ou quando a campanha finaliza). Opt-in por campanha.
  @Column({ type: DataType.INTEGER, allowNull: true })
  campaignTagId: number;

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

  // Flag para enviar mídia separada do texto (2 mensagens)
  @Column({ defaultValue: false })
  sendMediaSeparately: boolean;

  // Template oficial da Meta (API Oficial)
  @Column({ type: DataType.TEXT, allowNull: true })
  metaTemplateName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  metaTemplateLanguage: string;

  @Column({ type: DataType.JSON, allowNull: true })
  metaTemplateVariables: Record<string, any>;  // Mapeamento de variáveis do template
}

export default Campaign;
