import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  BeforeSave,
  DataType
} from "sequelize-typescript";
import Contact from "./Contact";
import AppError from "../errors/AppError";

const VALID_TYPES = ["text", "number", "date", "boolean", "select"];

interface TypedFieldInput {
  name: string;
  value: string;
  type?: string;
  options?: string[] | string | null;
}

/**
 * Validação pura (sem instância de Model), para ser chamada tanto pelo hook
 * `@BeforeSave` (cobre `.create()`/`.update()`) quanto explicitamente antes de
 * `.upsert()` — que no Sequelize v5 NÃO dispara hooks de instância no Postgres.
 *
 * Só valida quando `type` vem explicitamente preenchido com algo além de "text" —
 * campos antigos/sem tipo continuam sendo aceitos como texto livre, sem quebrar nada.
 */
export function validateCustomFieldTypedValue(field: TypedFieldInput): void {
  if (!field.type || field.type === "text") return;

  if (!VALID_TYPES.includes(field.type)) {
    throw new AppError(`Tipo de campo customizado inválido: "${field.type}"`);
  }

  const { value } = field;
  if (value === undefined || value === null || value === "") return;

  switch (field.type) {
    case "number":
      if (isNaN(Number(value))) {
        throw new AppError(`Campo "${field.name}" deve ser um número`);
      }
      break;
    case "date":
      if (isNaN(Date.parse(value))) {
        throw new AppError(`Campo "${field.name}" deve ser uma data válida`);
      }
      break;
    case "boolean":
      if (!["true", "false"].includes(String(value).toLowerCase())) {
        throw new AppError(`Campo "${field.name}" deve ser verdadeiro ou falso`);
      }
      break;
    case "select": {
      let options: string[] = [];
      if (field.options) {
        try {
          options = typeof field.options === "string" ? JSON.parse(field.options) : field.options;
        } catch {
          options = [];
        }
      }
      if (Array.isArray(options) && options.length > 0 && !options.includes(value)) {
        throw new AppError(`Campo "${field.name}" deve ser um dos valores: ${options.join(", ")}`);
      }
      break;
    }
    default:
      break;
  }
}

@Table
class ContactCustomField extends Model<ContactCustomField> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  value: string;

  // text (default, preserva comportamento atual de texto livre), number, date, boolean, select
  @Column({ defaultValue: "text" })
  type: string;

  // só usado quando type = "select" — lista de valores aceitos
  @Column(DataType.JSON)
  options: string[];

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BeforeSave
  static validateTypedValue(field: ContactCustomField) {
    validateCustomFieldTypedValue(field);
  }
}

export default ContactCustomField;
