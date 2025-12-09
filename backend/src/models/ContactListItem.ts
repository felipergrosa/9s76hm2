import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  HasOne,
  BeforeSave
} from "sequelize-typescript";
import Company from "./Company";
import ContactList from "./ContactList";
import Contact from "./Contact";
import { safeNormalizePhoneNumber } from "../utils/phone";

@Table({ tableName: "ContactListItems" })
class ContactListItem extends Model<ContactListItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  number: string;

  @Column
  canonicalNumber: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Column
  isWhatsappValid: boolean;

  @Column
  validatedAt: Date;

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

  @Column
  isGroup: boolean;

  @BelongsTo(() => Contact, { foreignKey: "canonicalNumber", targetKey: "canonicalNumber" })
  contact: Contact;

  /**
   * Hook BeforeSave para normalizar o número e preencher canonicalNumber
   */
  @BeforeSave
  static applyCanonicalNumber(item: ContactListItem) {
    if (item.isGroup) {
      item.canonicalNumber = null as any;
      return;
    }

    const shouldNormalize = item.changed("number") || !item.canonicalNumber;

    if (!shouldNormalize) {
      return;
    }

    const { canonical } = safeNormalizePhoneNumber(item.number);

    if (canonical) {
      item.canonicalNumber = canonical;
    } else {
      // Se não conseguir normalizar, usa o número original sem caracteres especiais
      item.canonicalNumber = (item.number || "").replace(/\D/g, "");
    }
  }
}

export default ContactListItem;
