import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo,
  AfterCreate,
  AfterDestroy,
  AfterBulkCreate,
  BeforeBulkDestroy,
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

  // Agenda re-sincronização das ContactLists com savedFilter da empresa —
  // tags entram no filtro (inclusive/exclusive, carteira via tag #)
  private static scheduleListSync(companyId?: number | null) {
    if (!companyId) return;
    setImmediate(async () => {
      try {
        const schedule = (await import("../helpers/scheduleSavedFilterSync")).default;
        schedule(companyId);
      } catch (err) {
        console.error("[Hook] Erro ao agendar sync de listas com savedFilter:", err);
      }
    });
  }

  private static async resolveCompanyIdsFromWhere(options: any): Promise<number[]> {
    const { extractCompanyIdsFromWhere } = await import("../helpers/scheduleSavedFilterSync");
    let ids = extractCompanyIdsFromWhere(options?.where);
    if (!ids.length && options?.where) {
      // where sem companyId (ex.: por contactId) — resolve consultando as linhas
      const rows = await ContactTag.findAll({
        where: options.where,
        attributes: ["companyId"],
        group: ["companyId"],
        raw: true
      });
      ids = rows.map((r: any) => r.companyId).filter(Boolean);
    }
    return ids;
  }

  // Hook para inscrever o contato em sequências de drip vinculadas a esta tag
  @AfterCreate
  static async enrollInDripSequencesAfterCreate(contactTag: ContactTag) {
    ContactTag.scheduleListSync(contactTag.companyId);
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

  @AfterDestroy
  static async scheduleListSyncAfterDestroy(contactTag: ContactTag) {
    ContactTag.scheduleListSync(contactTag.companyId);
  }

  @AfterBulkCreate
  static async scheduleListSyncAfterBulkCreate(contactTags: ContactTag[]) {
    const companyIds = new Set(contactTags.map(ct => ct.companyId).filter(Boolean));
    companyIds.forEach(id => ContactTag.scheduleListSync(id));
  }

  // BeforeBulkDestroy: resolve companyId ANTES de as linhas sumirem
  @BeforeBulkDestroy
  static async scheduleListSyncBeforeBulkDestroy(options: any) {
    try {
      const ids = await ContactTag.resolveCompanyIdsFromWhere(options);
      ids.forEach(id => ContactTag.scheduleListSync(id));
    } catch (err) {
      console.error("[Hook] Erro ao resolver companyId em bulkDestroy de ContactTag:", err);
    }
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
