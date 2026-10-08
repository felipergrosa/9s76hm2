import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

interface Request {
  sourceWhatsappId: number | string;
  targetWhatsappId: number | string;
  companyId: number;
}

// Atendimentos "ativos" = tudo que não está fechado. Cobre open, pending,
// group, chatbot, lgpd, nps e status futuros sem precisar de lista aberta.
const ACTIVE_WHERE = {
  status: { [Op.ne]: "closed" }
};

export const countActiveTickets = async (
  whatsappId: number | string,
  companyId: number
): Promise<number> => {
  return Ticket.count({
    where: {
      whatsappId,
      companyId,
      ...ACTIVE_WHERE
    }
  });
};

const TransferTicketsService = async ({
  sourceWhatsappId,
  targetWhatsappId,
  companyId
}: Request): Promise<{ transferred: number }> => {
  const [source, target] = await Promise.all([
    Whatsapp.findOne({
      where: { id: sourceWhatsappId, companyId },
      attributes: ["id", "name"]
    }),
    Whatsapp.findOne({
      where: { id: targetWhatsappId, companyId },
      attributes: ["id", "name"]
    })
  ]);

  if (!source || !target) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (source.id === target.id) {
    throw new AppError("ERR_SAME_CONNECTION", 400);
  }

  const [transferred] = await Ticket.update(
    { whatsappId: target.id },
    {
      where: {
        whatsappId: source.id,
        companyId,
        ...ACTIVE_WHERE
      }
    }
  );

  return { transferred };
};

export default TransferTicketsService;
