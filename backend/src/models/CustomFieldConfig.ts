import {
  Table, Column, CreatedAt, UpdatedAt, Model,
  DataType, BelongsTo, ForeignKey, PrimaryKey, AutoIncrement
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "CustomFieldConfigs" })
class CustomFieldConfig extends Model<CustomFieldConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // lead | ticket | company | deal
  @Column({ type: DataType.STRING(50), allowNull: false })
  entityType: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  key: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  label: string;

  // text | number | date | boolean | select
  @Column({ defaultValue: "text" })
  type: string;

  @Column(DataType.JSON)
  options: string[];

  @Column({ defaultValue: false })
  required: boolean;

  @Column({ defaultValue: 0 })
  position: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CustomFieldConfig;
