import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

// Cache local dos templates de mensagem da Meta (WhatsApp Business API)
// Sincronizado via API Graph — um registro por template por conexão
@Table({
  tableName: "WhatsappTemplates"
})
class WhatsappTemplate extends Model<WhatsappTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @AllowNull(false)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  // ID numérico do template na Meta (retornado pela API Graph como string)
  @Column(DataType.TEXT)
  metaTemplateId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  name: string;

  // Idioma do template (ex.: pt_BR, en_US)
  @Column(DataType.TEXT)
  language: string;

  // Categoria: MARKETING | UTILITY | AUTHENTICATION
  @Column(DataType.TEXT)
  category: string;

  // Status: APPROVED | PENDING | REJECTED | PAUSED | DISABLED | FLAGGED |
  // ARCHIVED | IN_APPEAL | PENDING_DELETION | DELETED | LOCKED | REINSTATED ...
  @Column(DataType.TEXT)
  status: string;

  // Formato dos parâmetros: "NAMED" | "POSITIONAL"
  @Column(DataType.TEXT)
  parameterFormat: string;

  // Array de components do template conforme retornado pela Meta
  // (HEADER, BODY, FOOTER, BUTTONS etc.)
  @Column(DataType.JSONB)
  components: any[];

  // Motivo de rejeição informado pela Meta (quando status = REJECTED)
  @AllowNull(true)
  @Column(DataType.TEXT)
  rejectedReason: string;

  // Caminho relativo (dentro de public/company{id}/) do arquivo de mídia do
  // HEADER persistido localmente na criação/edição do template
  @AllowNull(true)
  @Column(DataType.TEXT)
  headerMediaPath: string;

  // Data/hora da última sincronização com a API da Meta
  @AllowNull(true)
  @Column(DataType.DATE)
  lastSyncedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappTemplate;
