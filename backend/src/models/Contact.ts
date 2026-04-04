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

  @Column
  notify: string;

  @Column
  pushName: string;

  @Column
  verifiedName: string;

  @Default("")
  @Column
  profilePicUrl: string;

  @Column(DataType.TEXT)
  profilePicUrlHD: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default(false)
  @Column
  isGroupParticipant: boolean;

  @Default(false)
  @Column
  disableBot: boolean;

  @Default(true)
  @Column
  acceptAudioMessage: boolean;

  @Default(true)
  @Column
  active: boolean;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
    defaultValue: []
  })
  channels: string[];

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

  // Dados de Perfil e Business
  @Column(DataType.TEXT)
  about: string;

  @Column
  aboutTag: string;

  @Column
  isBusiness: boolean;

  @Column
  businessCategory: string;

  @Column(DataType.TEXT)
  businessDescription: string;

  @Column
  businessAddress: string;

  @Column
  businessEmail: string;

  @Column(DataType.JSON)
  businessWebsite: string[];

  @Column(DataType.JSON)
  businessHours: any;

  @Column
  businessVerifiedLevel: string;

  @Column(DataType.JSON)
  businessCatalog: any;

  // Metadados adicionais
  @Column({ defaultValue: false })
  isBlocked: boolean;

  @Column({ defaultValue: false })
  isMyContact: boolean;

  @Column({ defaultValue: false })
  isPremium: boolean;

  @Column({ defaultValue: false })
  isEnterprise: boolean;

  @Column(DataType.BIGINT)
  lastSeen: number;

  @Column({ defaultValue: false })
  isOnline: boolean;

  @Column(DataType.JSON)
  privacySettings: any;

  @Column
  lastDiscoveryAt: Date;

  @Column(DataType.JSON)
  rawData: any;

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

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    comment: "LID completo do WhatsApp (ex: 247540473708749@lid). Índice de lookup, nunca identificador primário."
  })
  lidJid: string;

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
      let file = this.getDataValue("urlPicture");
      if (file === 'nopicture.png') {
        return `${process.env.FRONTEND_URL}/nopicture.png`;
      }
      
      // CRÍTICO: Corrigir URLs duplicadas/corrompidas no banco
      // Ex: "https://dominio.comhttps//dominio.com/..." ou "dominio.comhttps//..."
      // Extrair apenas o caminho relativo se detectar duplicação
      if (file.includes('http') && (file.includes('/public/company') || file.includes('/contacts/'))) {
        // Extrair o caminho relativo a partir de /contacts/ ou após /public/companyX/
        const contactsMatch = file.match(/\/contacts\/([^?]+)/);
        if (contactsMatch) {
          file = `contacts/${contactsMatch[1]}`;
        } else {
          const publicMatch = file.match(/\/public\/company\d+\/(.+?)(\?|$)/);
          if (publicMatch) {
            file = publicMatch[1];
          }
        }
      }
      
      // CRÍTICO: Detectar URLs absolutas (mesmo mal formatadas) para evitar concatenação dupla
      // Ex: trata 'https://...', 'http://...' e erros comuns como 'https//...'
      const backendUrl = (process.env.BACKEND_URL || '').replace(/:\d+$/, '');
      const frontendUrl = (process.env.FRONTEND_URL || '').replace(/:\d+$/, '');
      
      const isAbsoluteUrl = file.startsWith('http://') || 
                            file.startsWith('https://') || 
                            file.startsWith('https//') ||
                            (backendUrl && file.includes(backendUrl)) ||
                            (frontendUrl && file.includes(frontendUrl));
      
      if (isAbsoluteUrl) {
        // Corrigir typo comum 'https//' -> 'https://'
        let correctedUrl = file;
        if (correctedUrl.startsWith('https//')) {
          correctedUrl = correctedUrl.replace('https//', 'https://');
        }
        // Se ainda tiver duplicação, extrair caminho relativo
        if (correctedUrl.match(/https?:\/\/.*https?:\/\//)) {
          const lastMatch = correctedUrl.match(/\/contacts\/([^?]+)/);
          if (lastMatch) {
            file = `contacts/${lastMatch[1]}`;
          } else {
            return correctedUrl; // Retornar como está se não conseguir extrair
          }
        } else {
          return correctedUrl;
        }
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

  @Column(DataType.VIRTUAL)
  get displayName(): string {
    const name = (this.getDataValue("name") || "").trim();
    const verifiedName = (this.getDataValue("verifiedName") || "").trim();
    const pushName = (this.getDataValue("pushName") || "").trim();
    const notify = (this.getDataValue("notify") || "").trim();
    const number = this.getDataValue("number");

    // 1. Nome salvo manualmente (não pode ser igual ao número)
    const isNameNumber = name.replace(/\D/g, "") === String(number).replace(/\D/g, "");
    if (name && !isNameNumber) return name;

    // 2. Nome verificado (Business)
    if (verifiedName) return verifiedName;

    // 3. pushName (notificação/webhook)
    if (pushName) return pushName;

    // 4. notify (agenda do wbot)
    if (notify) return notify;

    // 5. Fallback: Número
    return String(number);
  }

  /**
   * Retorna os IDs dos usuários donos deste contato baseado nas tags pessoais.
   * Após migração Wallet→Tag, busca usuários cuja tag pessoal está vinculada ao contato.
   */
  async getWalletOwners(): Promise<User[]> {
    const ContactTag = (await import("./ContactTag")).default;
    const User = (await import("./User")).default;
    const Tag = (await import("./Tag")).default;

    // Buscar tags do contato que são pessoais (começam com #)
    const contactTags = await ContactTag.findAll({
      where: { contactId: this.id },
      include: [{
        model: Tag,
        where: {
          name: {
            [require("sequelize").Op.and]: [
              { [require("sequelize").Op.like]: "#%" },
              { [require("sequelize").Op.notLike]: "##%" }
            ]
          }
        }
      }]
    });

    if (!contactTags.length) return [];

    const personalTagIds = contactTags.map(ct => ct.tagId);

    // Buscar usuários que têm essas tags como allowedContactTags
    const users = await User.findAll({
      where: {
        allowedContactTags: {
          [require("sequelize").Op.overlap]: personalTagIds
        }
      }
    });

    return users;
  }

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
