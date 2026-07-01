import {
  Table, Column, CreatedAt, UpdatedAt, Model,
  DataType, BelongsTo, ForeignKey, PrimaryKey, AutoIncrement
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import User from "./User";
import DealStage from "./DealStage";

@Table({ tableName: "Deals" })
class Deal extends Model<Deal> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @ForeignKey(() => DealStage) @Column stageId: number;
  @BelongsTo(() => DealStage) stage: DealStage;

  @ForeignKey(() => Contact) @Column({ allowNull: true }) contactId: number;
  @BelongsTo(() => Contact) contact: Contact;

  @ForeignKey(() => User) @Column({ allowNull: true }) userId: number;
  @BelongsTo(() => User) user: User;

  @Column({ allowNull: false }) title: string;
  @Column({ type: DataType.DECIMAL(15, 2), defaultValue: 0 }) value: number;
  @Column(DataType.TEXT) description: string;
  @Column({ defaultValue: "open" }) status: string; // open | won | lost
  @Column(DataType.DATE) closedAt: Date;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default Deal;
