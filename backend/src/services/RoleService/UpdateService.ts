import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { serviceCache } from "../../utils/serviceCache";
import {
  AVAILABLE_PERMISSIONS,
  getAllAvailablePermissions,
  invalidateRolePermissionsCache
} from "../../helpers/PermissionAdapter";

interface Request {
  id: string | number;
  companyId: number;
  name?: string;
  description?: string;
  permissions?: string[];
  // Flag do requisitante (vinda do DB) — permissões do grupo super só para super
  requestUserIsSuper?: boolean;
}

const UpdateService = async ({
  id,
  companyId,
  name,
  description,
  permissions,
  requestUserIsSuper = false
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
    // SEGURANÇA: valida permissions[] contra o catálogo conhecido — rejeita
    // chaves arbitrárias/desconhecidas e, para não-super, chaves do grupo super.
    const catalog = new Set(getAllAvailablePermissions());
    const superGroup = new Set<string>(AVAILABLE_PERMISSIONS.super);
    for (const p of permissions) {
      if (!catalog.has(p)) {
        throw new AppError(`Permissão desconhecida: ${p}`, 400);
      }
      if (!requestUserIsSuper && superGroup.has(p)) {
        throw new AppError("ERR_NO_PERMISSION - PERMISSAO RESTRITA A SUPER ADMIN", 403);
      }
    }
    role.permissions = permissions;
  }

  await role.save();

  // Permissões da Role mudaram — invalida o cache de quem está atribuído a ela
  const userRoles = await UserRole.findAll({ where: { roleId: role.id, companyId } });
  userRoles.forEach(ur => {
    invalidateRolePermissionsCache(ur.userId, companyId);
    // Também derruba o cache user:{id} do guard (middleware checkPermission)
    serviceCache.invalidate(`user:${ur.userId}`);
  });

  return role;
};

export default UpdateService;
