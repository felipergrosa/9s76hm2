import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import {
  AVAILABLE_PERMISSIONS,
  getAllAvailablePermissions
} from "../../helpers/PermissionAdapter";

interface Request {
  name: string;
  description?: string;
  permissions?: string[];
  companyId: number;
  // Flag do requisitante (vinda do DB) — permissões do grupo super só para super
  requestUserIsSuper?: boolean;
}

const CreateService = async ({
  name,
  description,
  permissions = [],
  companyId,
  requestUserIsSuper = false
}: Request): Promise<Role> => {
  if (!name || !name.trim()) {
    throw new AppError("ERR_ROLE_NAME_REQUIRED", 400);
  }

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

  const existing = await Role.findOne({ where: { name: name.trim(), companyId } });
  if (existing) {
    throw new AppError("ERR_ROLE_NAME_ALREADY_EXISTS", 400);
  }

  const role = await Role.create({
    name: name.trim(),
    description: description || null,
    permissions,
    companyId
  } as any);

  return role;
};

export default CreateService;
