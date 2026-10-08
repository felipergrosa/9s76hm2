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

  // Curtir automaticamente o comentário que disparou a regra (auto-like
  // estilo ManyChat). Só se aplica a gatilhos de comentário.
  @Column({ defaultValue: false })
  autoLikeComment: boolean;

  // Exigir que o remetente siga a conta para receber a DM. Check real só
  // existe no Instagram (is_user_follow_business); no Facebook é sempre
  // indeterminado e a regra segue fail-open.
  @Column({ defaultValue: false })
  requireFollower: boolean;

  // Ação quando o remetente NÃO é seguidor: "skip" (pula DM/fluxo) ou
  // "ask_follow" (envia nonFollowerText pedindo o follow)
  @Column({ defaultValue: "skip" })
  nonFollowerAction: string;

  // Mensagem enviada ao não-seguidor quando nonFollowerAction = ask_follow
  @Column(DataType.TEXT)
  nonFollowerText: string;

  // "Recompensa": URL pública de mídia/anexo enviado na DM (no private reply
  // de comentário vai como link no texto — a Meta só permite 1 mensagem)
  @Column(DataType.TEXT)
  rewardMediaUrl: string;

  // Tipo do attachment da recompensa: image | video | audio | file
  @Column
  rewardMediaType: string;

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
