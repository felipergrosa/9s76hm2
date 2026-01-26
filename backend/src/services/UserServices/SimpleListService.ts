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

  if (requestUserId) {
    whereCondition = {
      ...whereCondition,
      [Op.not]: {
        [Op.and]: [
          { isPrivate: true },
          { id: { [Op.ne]: requestUserId } }
        ]
      }
    };
  }

  const users = await User.findAll({
    where: whereCondition,
    attributes: ["name", "id", "email"],
    include: [
      { model: Queue, as: 'queues' }
    ],
    order: [["id", "ASC"]]
  });

  if (!users) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return users;
};

export default SimpleListService;
