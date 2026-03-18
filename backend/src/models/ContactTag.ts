import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Tag from "./Tag";
import Contact from "./Contact";
import Company from "./Company";

@Table({
  tableName: "ContactTags"
})
class ContactTag extends Model<ContactTag> {
  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @ForeignKey(() => Tag)
  @Column
  tagId: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @BelongsTo(() => Tag)
  tags: Tag;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactTag;
