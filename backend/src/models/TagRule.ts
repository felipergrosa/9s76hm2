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
  DataType,
  Default
} from "sequelize-typescript";
import Tag from "./Tag";
import Company from "./Company";

@Table
class TagRule extends Model<TagRule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Tag)
  @Column
  tagId: number;

  @BelongsTo(() => Tag)
  tag: Tag;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  field: string; // representativeCode, region, segment, city, etc

  @Default("equals")
  @Column
  operator: string; // equals, contains, in, etc

  @Column(DataType.TEXT)
  value: string; // Valor ou JSON array para operator 'in'

  @Default(true)
  @Column
  active: boolean;

  @Default("AND")
  @Column
  logic: string; // AND ou OR

  @Column
  lastAppliedAt: Date;

  @Default(0)
  @Column
  lastContactsAffected: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TagRule;
