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
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import KnowledgeDocument from "./KnowledgeDocument";

@Table({ tableName: "KnowledgeChunks" })
export default class KnowledgeChunk extends Model<KnowledgeChunk> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  companyId!: number;

  @BelongsTo(() => Company)
  company!: Company;

  @ForeignKey(() => KnowledgeDocument)
  @Column(DataType.INTEGER)
  documentId!: number;

  @BelongsTo(() => KnowledgeDocument)
  document!: KnowledgeDocument;

  @Column(DataType.INTEGER)
  chunkIndex!: number;

  @Column(DataType.TEXT)
  content!: string;

  // Nota: coluna real é do tipo pgvector. Aqui mapeamos como TEXT para evitar issues no sequelize-typescript.
  // Para escrita/leitura do embedding, usamos queries brutas (sequelize.query) no serviço RAG.
  @Column(DataType.TEXT)
  embedding?: string;

  @Column(DataType.FLOAT)
  score?: number;

  @Column(DataType.TEXT)
  tags?: string;

  @Column(DataType.TEXT)
  metadata?: string;

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt!: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt!: Date;
}
