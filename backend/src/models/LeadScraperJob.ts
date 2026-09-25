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
  // dados adicionais da Receita Federal
  capitalSocial?: string;
  dataAbertura?: string;
  // WhatsApp validado (dígitos, formato E.164 sem +)
  phoneValid?: boolean;
  // conselho profissional (ex.: CAU)
  registro?: string;      // número do registro profissional no conselho
  registroTipo?: string;  // tipo do registro/conselho, ex.: "CAU"
  // validação WhatsApp (pós-scrape, via sessão conectada da empresa)
  hasWhatsapp?: boolean;
  whatsappChecked?: boolean;
  // enriquecimento cruzado: fontes que complementaram o lead
  enrichedFrom?: string[];  // ex.: ["receita"]
  // busca global: fontes de origem do lead (ex.: ["google_maps","cnpj_search"])
  sources?: string[];
  imported?: boolean;
}

// Campos de filtro que aceitam seleção única ou múltipla — normalizados para
// array em runtime (ver toArray() em ScraperFilterUtils). Mantém string única
// aceita por retrocompatibilidade com jobs/integrações já existentes.
export type MultiValue = string | string[];

export interface ScraperFilters {
  // google_maps
  keyword?: string;
  city?: MultiValue;
  state?: MultiValue;
  // geo: busca por área no mapa (alternativa a city/state)
  lat?: number;
  lng?: number;
  radiusKm?: number;
  // cnpj (enrich)
  cnpjs?: string[];
  // cnpj_search (discovery)
  cnae?: MultiValue;
  naturezaJuridica?: MultiValue;
  situacao?: MultiValue;
  uf?: MultiValue;
  municipio?: MultiValue;
  regional?: MultiValue;
  temTelefone?: boolean;
  temEmail?: boolean;
  // 0/undefined = sem limite (até o teto absoluto de segurança do source)
  maxResults?: number;
  // ig_followers
  igTargetHandle?: string;
  // conselho (conselhos profissionais: CAU, futuramente CREA/CRM...)
  conselho?: "cau";
  conselhoTipo?: "profissional" | "empresa" | "ambos";
  // dedupe: quando true (padrão), ignora leads já capturados por qualquer job anterior da empresa
  skipDuplicates?: boolean;
  // carteira: usuário responsável já atribuído no momento da importação
  walletUserId?: number;
  // busca global: fontes habilitadas (default: todas aplicáveis)
  sources?: string[];
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

  @Column({ type: DataType.ENUM("pending", "running", "done", "error", "cancelled"), defaultValue: "pending" })
  status: "pending" | "running" | "done" | "error" | "cancelled";

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
