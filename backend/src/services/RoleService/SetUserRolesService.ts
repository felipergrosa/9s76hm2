import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { invalidateRolePermissionsCache } from "../../helpers/PermissionAdapter";

interface Request {
  userId: string | number;
  companyId: number;
  roleIds: number[];
}

/**
 * Substitui o conjunto completo de Roles atribuídas a um usuário (item 11 do
 * plano). Roles continuam sendo só uma fonte ADITIVA de permissões — não
 * removem nem substituem permissões já vindas de profile/flags/ACL pontual.
 */
const SetUserRolesService = async ({ userId, companyId, roleIds }: Request): Promise<UserRole[]> => {
  if (!Array.isArray(roleIds)) {
    throw new AppError("ERR_ROLE_IDS_INVALID", 400);
  }

  if (roleIds.length > 0) {
    const validRoles = await Role.findAll({ where: { id: roleIds, companyId } });
    if (validRoles.length !== new Set(roleIds).size) {
      throw new AppError("ERR_ROLE_NOT_FOUND", 404);
    }
  }

  await UserRole.destroy({ where: { userId, companyId } });

  const created = await Promise.all(
    roleIds.map(roleId => UserRole.create({ userId, roleId, companyId } as any))
  );

  invalidateRolePermissionsCache(Number(userId), companyId);

  return created;
};

export default SetUserRolesService;
