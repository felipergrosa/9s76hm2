import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { invalidateRolePermissionsCache } from "../../helpers/PermissionAdapter";

const DeleteService = async (id: string | number, companyId: number): Promise<void> => {
  const role = await Role.findOne({ where: { id, companyId } });

  if (!role) {
    throw new AppError("ERR_ROLE_NOT_FOUND", 404);
  }

  const userRoles = await UserRole.findAll({ where: { roleId: role.id, companyId } });

  await role.destroy(); // UserRoles são removidos em cascata (FK onDelete CASCADE)

  userRoles.forEach(ur => invalidateRolePermissionsCache(ur.userId, companyId));
};

export default DeleteService;
