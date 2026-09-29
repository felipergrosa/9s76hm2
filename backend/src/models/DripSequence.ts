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
import Queue from "./Queue";
import User from "./User";
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

  // Ação ao concluir o follow-up:
  // none | move_tag | ticket_status | assign_queue | assign_user
  @Column({ defaultValue: "none" })
  endAction: string;

  @ForeignKey(() => Tag)
  @Column
  endActionTagId: number;

  @BelongsTo(() => Tag, "endActionTagId")
  endActionTag: Tag;

  // open | pending | closed — usado por endAction = ticket_status
  @Column
  endActionStatus: string;

  @ForeignKey(() => Queue)
  @Column
  endActionQueueId: number;

  @BelongsTo(() => Queue)
  endActionQueue: Queue;

  @ForeignKey(() => User)
  @Column
  endActionUserId: number;

  @BelongsTo(() => User)
  endActionUser: User;

  // Janela de envio opcional ("08:00"–"20:00") — fora dela, reagenda para o início
  @Column
  sendWindowStart: string;

  @Column
  sendWindowEnd: string;

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
