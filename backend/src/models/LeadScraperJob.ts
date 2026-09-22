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
  cnaeId?: string;
  cnaeDescricao?: string;
  naturezaJuridica?: string;
  situacao?: string;
  porte?: string;
  municipio?: string;
  uf?: string;
  // social enrichment
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  instagramPhone?: string;
  googleMapsUrl?: string;
  // conselho profissional (ex.: CAU)
  registro?: string;      // número do registro profissional no conselho
  registroTipo?: string;  // tipo do registro/conselho, ex.: "CAU"
  imported?: boolean;
}

export interface ScraperFilters {
  // google_maps
  keyword?: string;
  city?: string;
  state?: string;
  // geo: busca por área no mapa (alternativa a city/state)
  lat?: number;
  lng?: number;
  radiusKm?: number;
  // cnpj (enrich)
  cnpjs?: string[];
  // cnpj_search (discovery)
  cnae?: string;
  naturezaJuridica?: string;
  situacao?: string;
  uf?: string;
  municipio?: string;
  temTelefone?: boolean;
  temEmail?: boolean;
  maxResults?: number;
  // ig_followers
  igTargetHandle?: string;
  // conselho (conselhos profissionais: CAU, futuramente CREA/CRM...)
  conselho?: "cau";
  conselhoTipo?: "profissional" | "empresa";
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
  source: "google_maps" | "cnpj" | "cnpj_search" | "ig_followers" | "conselho";

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

  // Status do envio em lote dos contatos importados para o ERP (via n8n)
  @Column(DataType.STRING)
  erpSyncStatus: "pending" | "sent" | "failed" | null;

  @Column(DataType.DATE)
  erpSyncedAt: Date | null;

  @Column(DataType.TEXT)
  erpSyncError: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LeadScraperJob;
