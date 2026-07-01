import {
  Table, Column, CreatedAt, UpdatedAt, Model,
  DataType, BelongsTo, ForeignKey, HasMany, PrimaryKey, AutoIncrement
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "DealStages" })
class DealStage extends Model<DealStage> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @Column({ allowNull: false }) name: string;
  @Column({ defaultValue: "#5C5C5C" }) color: string;
  @Column({ defaultValue: 0 }) position: number;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default DealStage;
