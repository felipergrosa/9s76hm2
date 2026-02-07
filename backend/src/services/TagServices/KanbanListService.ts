import { Op } from "sequelize";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import User from "../../models/User";

interface Request {
  companyId: number;
  userId?: number;
  profile?: string;
  super?: boolean;
  managedUserIds?: number[];
}

const KanbanListService = async ({
  companyId,
  userId,
  profile,
  super: isSuper,
  managedUserIds
}: Request): Promise<Tag[]> => {

  // Superadmin vê todas as lanes
  if (isSuper) {
    const tags = await Tag.findAll({
      where: {
        kanban: 1,
        companyId: companyId,
      },
      order: [["id", "ASC"]],
      raw: true,
    });
    return tags;
  }

  // Admin vê todas as lanes
  if (profile === "admin") {
    const tags = await Tag.findAll({
      where: {
        kanban: 1,
        companyId: companyId,
      },
      order: [["id", "ASC"]],
      raw: true,
    });
    return tags;
  }

  // Supervisor: vem lanes dele + dos supervisionados
  const allowedUserIds: number[] = [userId].filter(Boolean) as number[];
  if (managedUserIds && managedUserIds.length > 0) {
    allowedUserIds.push(...managedUserIds.map(id => Number(id)));
  }

  let whereCondition: any = {
    kanban: 1,
    companyId: companyId,
    [Op.or]: [
      { userId: null }, // Lanes públicas
      { userId: { [Op.in]: allowedUserIds } } // Lanes do usuário e supervisionados
    ]
  };

  const tags = await Tag.findAll({
    where: whereCondition,
    order: [["id", "ASC"]],
    raw: true,
  });

  return tags;
};

export default KanbanListService;