import { Op } from "sequelize";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";

interface Request {
  companyId: number;
  userId?: number;
}

const KanbanListService = async ({
  companyId,
  userId
}: Request): Promise<Tag[]> => {

  let whereCondition: any = {
    kanban: 1,
    companyId: companyId,
  };

  if (userId) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        { userId: null },
        { userId }
      ]
    };
  } else {
    whereCondition.userId = null;
  }

  const tags = await Tag.findAll({
    where: whereCondition,
    order: [["id", "ASC"]],
    raw: true,
  });

  return tags;
};

export default KanbanListService;