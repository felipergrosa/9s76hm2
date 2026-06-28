import UserRole from "../../models/UserRole";
import Role from "../../models/Role";

const ListUserRolesService = async (userId: string | number, companyId: number): Promise<Role[]> => {
  const userRoles = await UserRole.findAll({
    where: { userId, companyId },
    include: [{ model: Role, as: "role" }]
  });

  return userRoles.map(ur => (ur as any).role).filter(Boolean);
};

export default ListUserRolesService;
