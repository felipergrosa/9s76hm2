import { Op } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";

interface Params {
  companyId: string | number;
  requestUserId?: number | string;
}

const SimpleListService = async ({ companyId, requestUserId }: Params): Promise<User[]> => {
  let whereCondition: any = {
    companyId
  };

  console.log('[SimpleListService] Buscando usuários para companyId:', companyId);

  // Ghost Mode NÃO filtra lista de usuários
  // Usuários Ghost devem aparecer em seletores/dropdowns

  const users = await User.findAll({
    where: whereCondition,
    attributes: ["name", "id", "email", "profile"],
    include: [
      { 
        model: Queue, 
        as: 'queues', 
        attributes: ['id', 'name', 'color', 'participantName'],
        required: false // LEFT JOIN - inclui usuários mesmo sem filas
      }
    ],
    order: [["name", "ASC"]]
  });

  console.log('[SimpleListService] Total de usuários encontrados:', users?.length || 0);
  console.log('[SimpleListService] Usuários:', users?.map(u => ({ id: u.id, name: u.name })));

  if (!users) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return users;
};

export default SimpleListService;
