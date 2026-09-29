import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo,
  AfterCreate
} from "sequelize-typescript";
import Tag from "./Tag";
import Ticket from "./Ticket";
import Company from "./Company";
import logger from "../utils/logger";

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

  /**
   * Contato entrou numa lane do Kanban (tag com kanban=1 aplicada ao ticket).
   * Inscreve o contato do ticket nas drip sequences vinculadas a essa tag —
   * complementa o gatilho de ContactTag, que cobre tags no contato.
   */
  @AfterCreate
  static async enrollInDripSequencesAfterLaneEntry(ticketTag: TicketTag) {
    try {
      const tag = await Tag.findByPk(ticketTag.tagId, {
        attributes: ["id", "kanban"]
      });
      if (!tag || Number(tag.kanban) !== 1) return;

      const ticket = await Ticket.findByPk(ticketTag.ticketId, {
        attributes: ["id", "contactId"]
      });
      if (!ticket?.contactId) return;

      const EnrollContactInDripSequencesService = (
        await import("../services/DripSequenceService/EnrollContactInDripSequencesService")
      ).default;

      await EnrollContactInDripSequencesService({
        companyId: ticketTag.companyId,
        contactId: ticket.contactId,
        tagId: ticketTag.tagId
      });
    } catch (err: any) {
      logger.error(
        `[TicketTag] Erro ao inscrever contato em drip sequence via lane: ${err?.message}`
      );
    }
  }
}

export default TicketTag;
