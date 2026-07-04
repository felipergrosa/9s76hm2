import {
  Table, Column, CreatedAt, UpdatedAt, Model,
  DataType, BelongsTo, ForeignKey
} from "sequelize-typescript";
import Company from "./Company";

export interface ScraperResult {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  rating?: string;
  category?: string;
  // CNPJ fields
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnaeDescricao?: string;
  situacao?: string;
  porte?: string;
  municipio?: string;
  uf?: string;
  // social enrichment
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  instagramPhone?: string;
  imported?: boolean;
}

export interface ScraperFilters {
  // google_maps
  keyword?: string;
  city?: string;
  state?: string;
  // cnpj (enrich)
  cnpjs?: string[];
  // cnpj_search (discovery)
  cnae?: string;
  situacao?: string;
  uf?: string;
  municipio?: string;
  identificadorMatrizFilial?: "1" | "2";
  dataAberturaInicio?: string;
  dataAberturaFim?: string;
  temTelefone?: boolean;
  temEmail?: boolean;
  maxResults?: number;
  // ig_followers
  igTargetHandle?: string;
}

@Table
class LeadScraperJob extends Model<LeadScraperJob> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column({ type: DataType.STRING, allowNull: false })
  source: "google_maps" | "cnpj" | "cnpj_search" | "ig_followers";

  @Column({ type: DataType.ENUM("pending", "running", "done", "error"), defaultValue: "pending" })
  status: "pending" | "running" | "done" | "error";

  @Column({ type: DataType.JSON, defaultValue: {} })
  filters: ScraperFilters;

  @Column({ type: DataType.JSON, defaultValue: [] })
  results: ScraperResult[];

  @Column({ defaultValue: 0 })
  progress: number;

  @Column({ defaultValue: 0 })
  totalFound: number;

  @Column(DataType.TEXT)
  errorMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LeadScraperJob;
