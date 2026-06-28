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
  DataType
} from "sequelize-typescript";
import DripSequence from "./DripSequence";

@Table({ tableName: "DripSequenceSteps" })
class DripSequenceStep extends Model<DripSequenceStep> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => DripSequence)
  @Column
  dripSequenceId: number;

  @BelongsTo(() => DripSequence)
  dripSequence: DripSequence;

  @Column({ defaultValue: 0 })
  order: number;

  @Column({ defaultValue: 0 })
  delayDays: number;

  @Column(DataType.TEXT)
  message: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DripSequenceStep;
