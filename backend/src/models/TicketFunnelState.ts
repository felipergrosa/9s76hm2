import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Ticket from "./Ticket";
import FunnelStage from "./FunnelStage";
import AIAgent from "./AIAgent";
import Company from "./Company";

// item 12 do plano: histórico/snapshot de qual etapa do funil cada ticket
// esteve em cada momento. A linha mais recente (por createdAt) para um
// ticket+agente representa a etapa atual.
@Table({ tableName: "TicketFunnelStates" })
class TicketFunnelState extends Model<TicketFunnelState> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => FunnelStage)
  @Column
  funnelStageId: number;

  @BelongsTo(() => FunnelStage)
  funnelStage: FunnelStage;

  @ForeignKey(() => AIAgent)
  @Column
  agentId: number;

  @BelongsTo(() => AIAgent)
  agent: AIAgent;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  enteredAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TicketFunnelState;
