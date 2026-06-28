import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo,
  AfterCreate
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

  // Hook para inscrever o contato em sequências de drip vinculadas a esta tag
  @AfterCreate
  static async enrollInDripSequencesAfterCreate(contactTag: ContactTag) {
    // Executa de forma assíncrona sem bloquear quem criou a tag
    setImmediate(async () => {
      try {
        const EnrollContactInDripSequencesService = (
          await import("../services/DripSequenceService/EnrollContactInDripSequencesService")
        ).default;
        await EnrollContactInDripSequencesService({
          companyId: contactTag.companyId,
          contactId: contactTag.contactId,
          tagId: contactTag.tagId
        });
      } catch (err) {
        console.error(`[Hook] Erro ao inscrever contato ${contactTag.contactId} em drip sequences:`, err);
      }
    });
  }
}

export default ContactTag;
