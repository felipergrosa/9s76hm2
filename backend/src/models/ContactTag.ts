import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo,
  AfterCreate,
  BeforeValidate
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

  @BeforeValidate
  static async checkCompanyId(instance: ContactTag) {
    if (!instance.companyId) {
      if (instance.contactId) {
        const ContactModel = (await import("./Contact")).default;
        const contact = await ContactModel.findByPk(instance.contactId, { attributes: ["companyId"] });
        if (contact) {
          instance.companyId = contact.companyId;
          return;
        }
      }
      if (instance.tagId) {
        const TagModel = (await import("./Tag")).default;
        const tag = await TagModel.findByPk(instance.tagId, { attributes: ["companyId"] });
        if (tag) {
          instance.companyId = tag.companyId;
          return;
        }
      }
    }
  }
}

export default ContactTag;
