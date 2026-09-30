import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  HasMany,
  Default,
  BeforeValidate
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";
import User from "./User";
import QueueIntegrations from "./QueueIntegrations";
import Files from "./Files";

@Table
class Chatbot extends Model<Chatbot> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Column
  greetingMessage: string;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue, "queueId")
  queue: Queue;

  @ForeignKey(() => Chatbot)
  @Column
  chatbotId: number;

  @Column
  isAgent: boolean;

  @BelongsTo(() => Chatbot)
  mainChatbot: Chatbot;

  @HasMany(() => Chatbot)
  options: Chatbot[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  queueType: string;

  @ForeignKey(() => Queue)
  @Column
  optQueueId: number;

  @BelongsTo(() => Queue, "optQueueId")
  optQueue: Queue;

  @ForeignKey(() => User)
  @Column
  optUserId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => QueueIntegrations)
  @Column
  optIntegrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @ForeignKey(() => Files)
  @Column
  optFileId: number;

  @BelongsTo(() => Files)
  file: Files;

  @Default(false)
  @Column
  closeTicket: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Fallback de tenant: linhas criadas via associação (ex.: Queue.create com
  // chatbots embutidos) não trazem companyId — resolve a partir da fila.
  @BeforeValidate
  static async fillCompanyIdFromQueue(instance: Chatbot): Promise<void> {
    if (instance.companyId || !instance.queueId) return;
    const queue = await Queue.findByPk(instance.queueId, { attributes: ["id", "companyId"] });
    if (queue) {
      instance.companyId = queue.companyId;
    }
  }
}

export default Chatbot;
