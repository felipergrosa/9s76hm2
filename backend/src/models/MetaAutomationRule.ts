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
import Company from "./Company";
import Whatsapp from "./Whatsapp";
import { FlowBuilderModel } from "./FlowBuilder";

/**
 * Regra de automação Meta (estilo ManyChat): dispara DM/resposta pública/fluxo
 * a partir de gatilhos de engajamento (comentário, menção em story, referral).
 */
@Table({ tableName: "MetaAutomationRules" })
class MetaAutomationRule extends Model<MetaAutomationRule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Conexão Meta (página FB ou conta IG) que recebe o webhook
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  name: string;

  // "facebook" | "instagram" | "both"
  @Column
  channel: string;

  // comment_keyword | comment_any | story_mention | referral_ref | dm_keyword
  @Column
  trigger: string;

  // Keyword, postId/mediaId ou ref — null = casa qualquer evento do trigger
  @Column
  matchValue: string;

  // Texto da DM enviada; {{contact.name}} interpolável
  @Column(DataType.TEXT)
  dmText: string;

  // Resposta pública ao comentário
  @Column(DataType.TEXT)
  publicReplyText: string;

  // Fluxo FlowBuilder disparado na DM — se setado, dmText é opcional
  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowId: number;

  @BelongsTo(() => FlowBuilderModel)
  flow: FlowBuilderModel;

  @Column({ defaultValue: true })
  active: boolean;

  @Column({ defaultValue: 0 })
  sentCount: number;

  @Column
  lastTriggeredAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MetaAutomationRule;
