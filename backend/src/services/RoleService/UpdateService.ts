import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { invalidateRolePermissionsCache } from "../../helpers/PermissionAdapter";

interface Request {
  id: string | number;
  companyId: number;
  name?: string;
  description?: string;
  permissions?: string[];
}

const UpdateService = async ({
  id,
  companyId,
  name,
  description,
  permissions
}: Request): Promise<Role> => {
  const role = await Role.findOne({ where: { id, companyId } });

  if (!role) {
    throw new AppError("ERR_ROLE_NOT_FOUND", 404);
  }

  if (name && name.trim()) {
    const existing = await Role.findOne({
      where: { name: name.trim(), companyId, id: { [Op.ne]: id } }
    });
    if (existing) {
      throw new AppError("ERR_ROLE_NAME_ALREADY_EXISTS", 400);
    }
    role.name = name.trim();
  }

  if (description !== undefined) {
    role.description = description;
  }

  if (permissions !== undefined) {
    role.permissions = permissions;
  }

  await role.save();

  // Permissões da Role mudaram — invalida o cache de quem está atribuído a ela
  const userRoles = await UserRole.findAll({ where: { roleId: role.id, companyId } });
  userRoles.forEach(ur => invalidateRolePermissionsCache(ur.userId, companyId));

  return role;
};

export default UpdateService;
