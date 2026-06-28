import AppError from "../../errors/AppError";
import Role from "../../models/Role";

const ShowService = async (id: string | number, companyId: number): Promise<Role> => {
  const role = await Role.findOne({ where: { id, companyId } });

  if (!role) {
    throw new AppError("ERR_ROLE_NOT_FOUND", 404);
  }

  return role;
};

export default ShowService;
