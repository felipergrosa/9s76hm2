import { Op } from "sequelize";
import TicketTraking from "../../models/TicketTraking";

interface Params {
  ticketId: string | number;
  companyId: string | number;
  whatsappId?: string | number;
  userId?: string | number;
  queueId?: string | number;
}

const FindOrCreateATicketTrakingService = async ({
  ticketId,
  companyId,
  whatsappId,
  userId,
  queueId
}: Params): Promise<TicketTraking> => {
  const ticketTraking = await TicketTraking.findOne({
    where: {
      ticketId,
      finishedAt: {
        [Op.is]: null
      }
    }
  });

  if (ticketTraking) {
    if ((ticketTraking.queueId === null || ticketTraking.queueId === undefined) && queueId) {
      await ticketTraking.update({ queueId: Number(queueId) });
    }
    return ticketTraking;
  }

  const newRecord = await TicketTraking.create({
    ticketId,
    companyId,
    whatsappId,
    userId,
    queueId: queueId ? Number(queueId) : null
  });

  return newRecord;
};

export default FindOrCreateATicketTrakingService;