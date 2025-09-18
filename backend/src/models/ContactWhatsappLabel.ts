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
import Contact from "./Contact";
import WhatsappLabel from "./WhatsappLabel";

@Table
class ContactWhatsappLabel extends Model<ContactWhatsappLabel> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => WhatsappLabel)
  @Column
  whatsappLabelId: number;

  @BelongsTo(() => WhatsappLabel)
  whatsappLabel: WhatsappLabel;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactWhatsappLabel;
