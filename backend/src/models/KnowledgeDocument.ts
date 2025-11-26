import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import KnowledgeChunk from "./KnowledgeChunk";
import LibraryFile from "./LibraryFile";

@Table({ tableName: "KnowledgeDocuments" })
export default class KnowledgeDocument extends Model<KnowledgeDocument> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  companyId!: number;

  @BelongsTo(() => Company)
  company!: Company;

  @Column(DataType.STRING)
  title!: string;

  @Column(DataType.STRING)
  source?: string;

  @Column(DataType.STRING)
  mimeType?: string;

  @Column(DataType.INTEGER)
  size?: number;

  @Column(DataType.TEXT)
  tags?: string; // JSON string array or comma-separated

  @Column(DataType.TEXT)
  metadata?: string; // JSON string

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt!: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt!: Date;

  @HasMany(() => KnowledgeChunk)
  chunks!: KnowledgeChunk[];

  @HasMany(() => LibraryFile)
  libraryFiles!: LibraryFile[];
}
