import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Default,
  HasMany,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  DataType,
  AfterCreate,
  AfterUpdate,
  BeforeSave
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import Ticket from "./Ticket";
import Company from "./Company";
import Schedule from "./Schedule";
import ContactTag from "./ContactTag";
import Tag from "./Tag";
import ContactWallet from "./ContactWallet";
import User from "./User";
import Whatsapp from "./Whatsapp";
import { safeNormalizePhoneNumber } from "../utils/phone";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    comment: "Código do Cliente - identificador único do cliente no sistema externo"
  })
  clientCode: string;

  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  number: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    defaultValue: DataType.UUIDV4
  })
  uuid: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Column
  canonicalNumber: string;

  @Default("")
  @Column
  profilePicUrl: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default(false)
  @Column
  disableBot: boolean;

  @Default(true)
  @Column
  acceptAudioMessage: boolean;

  @Default(true)
  @Column
  active: boolean;

  @Default("whatsapp")
  @Column
  channel: string;

  // Novos campos adicionados
  @Column({
    allowNull: true,
    validate: {
      isValidDocument(value: string) {
        if (value) {
          const cleanDoc = value.replace(/\D/g, '');
          if (![11, 14].includes(cleanDoc.length)) {
            throw new Error('CPF/CNPJ inválido');
          }
        }
      }
    },
    set(value: string | number) {
      if (value) {
        (this as any).setDataValue('cpfCnpj', String(value));
      } else {
        (this as any).setDataValue('cpfCnpj', null);
      }
    }
  })
  cpfCnpj: string;

  @Column({
    allowNull: true
  })
  representativeCode: string;

  @Column({
    allowNull: true
  })
  city: string;

  @Column({
    allowNull: true
  })
  instagram: string;

  @Column({
    allowNull: true
  })
  contactName: string;

  @Default(false)
  @Column
  florder: boolean;

  @Column({
    allowNull: true
  })
  segment: string;

  @Column({
    type: 'ENUM',
    values: ['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo'],
    allowNull: true,
    defaultValue: 'Ativo'
  })
  situation: string;

  @Column({
    allowNull: true
  })
  fantasyName: string;

  @Column({
    type: 'DATEONLY',
    allowNull: true,
    set(value: Date | number) {
      if (typeof value === 'number' && value > 0) {
        // Convert Excel serial date to JS Date object
        const date = new Date((value - 25569) * 86400 * 1000);
        (this as any).setDataValue('foundationDate', date);
      } else {
        (this as any).setDataValue('foundationDate', value);
      }
    }
  })
  foundationDate: Date;

  @Column({
    type: 'VARCHAR(50)',
    allowNull: true
  })
  creditLimit: string;

  @Column({
    type: 'DATEONLY',
    allowNull: true
  })
  dtUltCompra: Date;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true
  })
  vlUltCompra: number;

  @Column({
    allowNull: true
  })
  bzEmpresa: string;

  @Column({
    allowNull: true
  })
  region: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @HasMany(() => ContactTag)
  contactTags: ContactTag[];

  @BelongsToMany(() => Tag, () => ContactTag)
  tags: Tag[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Schedule, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  schedules: Schedule[];

  @Column
  remoteJid: string;

  @Column
  lgpdAcceptedAt: Date;

  @Column
  pictureUpdated: boolean;

  @Column
  isWhatsappValid: boolean;

  @Column
  validatedAt: Date;

  @Column
  get urlPicture(): string | null {
    if (this.getDataValue("urlPicture")) {
      const file = this.getDataValue("urlPicture");
      if (file === 'nopicture.png') {
        return `${process.env.FRONTEND_URL}/nopicture.png`;
      }
      // Se já vier com subpastas, considerar relativo à raiz da company
      const relative = file.includes('/') ? file : `contacts/${file}`;
      // Monta origem preferindo sempre o backend (que serve /public)
      const be = (process.env.BACKEND_URL || '').trim();
      const fe = (process.env.FRONTEND_URL || '').trim();
      const proxyPort = (process.env.PROXY_PORT || '').trim();
      const devFallback = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';
      const origin = be
        ? `${be}${proxyPort ? `:${proxyPort}` : ''}`
        : (fe || devFallback);
      const base = origin
        ? `${origin}/public/company${this.companyId}/${relative}`
        : `/public/company${this.companyId}/${relative}`;
      const version = this.updatedAt ? new Date(this.updatedAt).getTime() : '';
      return version ? `${base}?v=${version}` : base;
    }
    return null;
  }

  @BelongsToMany(() => User, () => ContactWallet, "contactId", "walletId")
  wallets: ContactWallet[];

  @HasMany(() => ContactWallet)
  contactWallets: ContactWallet[];

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @BeforeSave
  static applyCanonicalNumber(contact: Contact) {
    if (contact.isGroup) {
      contact.canonicalNumber = null;
      return;
    }

    const shouldNormalize = contact.changed("number") || !contact.canonicalNumber;

    if (!shouldNormalize) {
      return;
    }

    const { canonical } = safeNormalizePhoneNumber(contact.number);

    if (canonical) {
      contact.setDataValue("number", canonical);
      contact.canonicalNumber = canonical;
    } else {
      contact.canonicalNumber = null;
    }
  }

  // Hook para aplicar regras de tags automaticamente após criar contato
  @AfterCreate
  static async applyTagRulesAfterCreate(contact: Contact) {
    // Executa de forma assíncrona sem bloquear
    setImmediate(async () => {
      try {
        const ApplyTagRulesService = (await import("../services/TagServices/ApplyTagRulesService")).default;
        await ApplyTagRulesService({
          companyId: contact.companyId,
          contactId: contact.id
        });
      } catch (err) {
        console.error(`[Hook] Erro ao aplicar regras de tags no contato ${contact.id}:`, err);
      }
    });
  }

  // Hook para aplicar regras de tags automaticamente após atualizar contato
  @AfterUpdate
  static async applyTagRulesAfterUpdate(contact: Contact) {
    // Executa de forma assíncrona sem bloquear
    setImmediate(async () => {
      try {
        const ApplyTagRulesService = (await import("../services/TagServices/ApplyTagRulesService")).default;
        await ApplyTagRulesService({
          companyId: contact.companyId,
          contactId: contact.id
        });
      } catch (err) {
        console.error(`[Hook] Erro ao aplicar regras de tags no contato ${contact.id}:`, err);
      }
    });
  }
}

export default Contact;
