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
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import Tag from "./Tag";
import Whatsapp from "./Whatsapp";
import DripSequenceStep from "./DripSequenceStep";
import DripSequenceEnrollment from "./DripSequenceEnrollment";

@Table({ tableName: "DripSequences" })
class DripSequence extends Model<DripSequence> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column({ defaultValue: true })
  active: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Tag)
  @Column
  tagId: number;

  @BelongsTo(() => Tag)
  tag: Tag;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @HasMany(() => DripSequenceStep)
  steps: DripSequenceStep[];

  @HasMany(() => DripSequenceEnrollment)
  enrollments: DripSequenceEnrollment[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DripSequence;
