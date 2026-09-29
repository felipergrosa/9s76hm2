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
import DripSequence from "./DripSequence";

@Table({ tableName: "DripSequenceSteps" })
class DripSequenceStep extends Model<DripSequenceStep> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => DripSequence)
  @Column
  dripSequenceId: number;

  @BelongsTo(() => DripSequence)
  dripSequence: DripSequence;

  @Column({ defaultValue: 0 })
  order: number;

  @Column({ defaultValue: 0 })
  delayDays: number;

  // Delay adicional em minutos — somado a delayDays para granularidade fina
  // (follow-up em minutos/horas, não apenas dias)
  @Column({ defaultValue: 0 })
  delayMinutes: number;

  @Column(DataType.TEXT)
  message: string;

  // Template Meta opcional: obrigatório em conexão oficial fora da janela de 24h.
  // Quando preenchido, o step envia o template em vez de mensagem livre.
  @Column(DataType.TEXT)
  metaTemplateName: string;

  @Column
  metaTemplateLanguage: string;

  // JSON no formato de variablesConfig (mesmo das campanhas Meta)
  @Column(DataType.TEXT)
  metaTemplateVariables: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DripSequenceStep;
