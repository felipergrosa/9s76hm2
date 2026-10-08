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
import Company from "./Company";
import Whatsapp from "./Whatsapp";
import User from "./User";
import Contact from "./Contact";

/**
 * Registro de chamada de voz (WhatsApp Plus — Voz+Msg).
 *
 * Alimentado pelo endpoint service-to-service POST /call-logs (microserviço
 * "wacalls" ou provedor SIP futuro). Leitura apenas via relatório /call-report
 * — nunca editar/remover registros por API de usuário.
 */
@Table({ tableName: "CallLogs" })
class CallLog extends Model<CallLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Conexão WhatsApp/linha pela qual a chamada passou
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  // Atendente que respondeu/originou a chamada (nulo em perdidas sem dono)
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  // Contato resolvido pelo número (nulo quando não cadastrado)
  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  // Número remoto (dígitos, E.164 sem "+")
  @Column
  number: string;

  // "in" = recebida | "out" = originada
  @Column
  direction: string;

  // "answered" | "missed" | "rejected" | "failed"
  @Column
  status: string;

  // Duração efetiva da conversa em segundos
  @Default(0)
  @Column(DataType.INTEGER)
  durationSeconds: number;

  // Início do evento de chamada (ring)
  @Column
  startedAt: Date;

  // Fim da chamada (nulo quando não informado pelo provedor)
  @Column
  endedAt: Date;

  // "wacalls" | "sip" — provedor que reportou o evento
  @Default("wacalls")
  @Column
  provider: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CallLog;
