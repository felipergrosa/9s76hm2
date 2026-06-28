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
import { FlowBuilderModel } from "./FlowBuilder";
import Ticket from "./Ticket";
import Company from "./Company";

@Table({ tableName: "FlowExecutionLogs" })
class FlowExecutionLog extends Model<FlowExecutionLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowBuilderId: number;

  @BelongsTo(() => FlowBuilderModel)
  flowBuilder: FlowBuilderModel;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  nodeId: string;

  @Column
  nodeType: string;

  @Column({ defaultValue: "executed" })
  status: string;

  @Column(DataType.TEXT)
  errorMessage: string;

  @Column(DataType.JSON)
  contextSnapshot: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowExecutionLog;
