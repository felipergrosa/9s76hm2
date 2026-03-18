import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Tag from "./Tag";
import Ticket from "./Ticket";
import Company from "./Company";

@Table({
  tableName: 'TicketTags'
})
class TicketTag extends Model<TicketTag> {
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

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

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TicketTag;
