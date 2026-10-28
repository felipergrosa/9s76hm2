import { Transaction } from "sequelize";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { serviceCache } from "../../utils/serviceCache";
import {
  getAdminPermissions,
  invalidateRolePermissionsCache
} from "../../helpers/PermissionAdapter";

/**
 * Role de sistema "Administrador" — fase 3 (composição de permissões).
 *
 * profile="admin" deixou de conceder permissões automaticamente: os poderes
 * do admin passam a vir desta Role atribuída via UserRole. A description é a
 * marca que identifica a role criada pela migration/system (usada também no
 * down da migration 20261006000001-admin-role-composition).
 */
export const ADMIN_ROLE_NAME = "Administrador";
export const ADMIN_ROLE_DESCRIPTION =
  "Role de sistema: administradores da empresa. Criada pela migração de composição de permissões.";

/**
 * Garante que a empresa tenha a Role "Administrador" (find-or-create por
 * companyId+name). Cobre o edge case de empresa criada depois da migration
 * de composição. Idempotente e tolerante a corrida entre requisições.
 * Aceita `transaction` opcional para participar da transação do caller
 * (ex.: criação de empresa + usuário admin no CreateCompanyService).
 */
const EnsureAdminRoleService = async (
  companyId: number,
  transaction?: Transaction
): Promise<Role> => {
  const existing = await Role.findOne({
    where: { name: ADMIN_ROLE_NAME, companyId },
    transaction
  });
  if (existing) {
    // Self-heal: role de sistema (marca da description) é re-sincronizada
    // com o catálogo vivo — corrige drift (ex.: snapshot da migration
    // 20261006000001 ficou sem as permissões meta-automations.*).
    if (existing.description === ADMIN_ROLE_DESCRIPTION) {
      const live = getAdminPermissions();
      const current = Array.isArray(existing.permissions)
        ? existing.permissions
        : [];
      const drift =
        live.length !== current.length ||
        live.some(p => !current.includes(p)) ||
        current.some(p => !live.includes(p));
      if (drift) {
        await existing.update({ permissions: live } as any, { transaction });
        // Permissões da role mudaram — invalida o cache dos atribuídos.
        const userRoles = await UserRole.findAll({
          where: { roleId: existing.id, companyId },
          transaction
        });
        userRoles.forEach(ur => {
          invalidateRolePermissionsCache(ur.userId, companyId);
          serviceCache.invalidate(`user:${ur.userId}`);
        });
      }
    }
    return existing;
  }

  try {
    return await Role.create({
      name: ADMIN_ROLE_NAME,
      description: ADMIN_ROLE_DESCRIPTION,
      permissions: getAdminPermissions(),
      companyId
    } as any, { transaction });
  } catch (err) {
    // Corrida: outra requisição pode ter criado a Role primeiro — relê antes
    // de propagar o erro (ex.: unique de name+companyId, se houver).
    const concurrent = await Role.findOne({
      where: { name: ADMIN_ROLE_NAME, companyId },
      transaction
    });
    if (concurrent) return concurrent;
    throw err;
  }
};

export default EnsureAdminRoleService;
