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
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";
import ContactWhatsappLabel from "./ContactWhatsappLabel";

@Table
class WhatsappLabel extends Model<WhatsappLabel> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING)
  whatsappLabelId: string;

  @Column(DataType.STRING)
  name: string;

  @Column(DataType.INTEGER)
  color: number;

  @Column(DataType.STRING)
  predefinedId: string;

  @Column(DataType.BOOLEAN)
  deleted: boolean;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @HasMany(() => ContactWhatsappLabel)
  contactLabels: ContactWhatsappLabel[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappLabel;
