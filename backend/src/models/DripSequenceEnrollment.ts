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
import Contact from "./Contact";
import Company from "./Company";

@Table({ tableName: "DripSequenceEnrollments" })
class DripSequenceEnrollment extends Model<DripSequenceEnrollment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => DripSequence)
  @Column
  dripSequenceId: number;

  @BelongsTo(() => DripSequence)
  dripSequence: DripSequence;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column({ defaultValue: 0 })
  currentStepIndex: number;

  @Column({ defaultValue: "active" })
  // active, waiting_window, completed, failed, cancelled
  // waiting_window = step de texto livre segurado fora da janela de 24h da
  // API Oficial — reenvia quando o contato reabrir a janela (TTL no queue)
  status: string;

  @Column
  nextSendAt: Date;

  @Column
  enrolledAt: Date;

  @Column({ defaultValue: 0 })
  attempts: number;

  @Column(DataType.TEXT)
  lastError: string;

  @Column
  lastErrorAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DripSequenceEnrollment;
