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
  Default,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

// Tarifa por mensagem da Meta calculada a partir de pricing_analytics
// (cost/volume por categoria/país) ou configurada manualmente.
// rate = preço na moeda da WABA; rateBrl = convertido para R$.
@Table({ tableName: "WabaPricingRates" })
class WabaPricingRate extends Model<WabaPricingRate> {
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

  // MARKETING | UTILITY | AUTHENTICATION
  @AllowNull(false)
  @Column(DataType.STRING(30))
  category: string;

  @Default("BR")
  @Column(DataType.STRING(2))
  country: string;

  @Column(DataType.DECIMAL(12, 6))
  rate: number;

  @Default("USD")
  @Column(DataType.STRING(8))
  currency: string;

  @Column(DataType.DECIMAL(12, 6))
  rateBrl: number;

  @Column(DataType.STRING(30))
  tier: string;

  @Default("meta")
  @Column(DataType.STRING(10))
  source: string;

  @Column(DataType.DATE)
  lastSyncAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WabaPricingRate;
