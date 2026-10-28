import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Role from "../../models/Role";
import User from "../../models/User";
import UserRole from "../../models/UserRole";
import { serviceCache } from "../../utils/serviceCache";
import { invalidateRolePermissionsCache } from "../../helpers/PermissionAdapter";
import EnsureAdminRoleService, {
  ADMIN_ROLE_NAME
} from "./EnsureAdminRoleService";

interface Request {
  userId: string | number;
  companyId: number;
  roleIds: number[];
  // Requisitante FRESCO do DB — necessário para o gate de concessão
  // explícita da role de sistema "Administrador" (apenas super admin).
  requestUserId: number;
}

/**
 * Substitui o conjunto completo de Roles atribuídas a um usuário (item 11 do
 * plano). Roles continuam sendo só uma fonte ADITIVA de permissões — não
 * removem nem substituem permissões já vindas de profile/flags/ACL pontual.
 *
 * Invariantes preservadas:
 * - Alvo com profile="admin" sempre mantém a UserRole "Administrador"
 *   (composição de permissões — sem ela o admin perde o conjunto delegado
 *   pela role de sistema e fica limitado às permissões da role manual).
 * - A role "Administrador" só pode ser concedida explicitamente por super
 *   admin — mesmo gate de profile=admin do CreateUserService.
 */
const SetUserRolesService = async ({
  userId,
  companyId,
  roleIds,
  requestUserId
}: Request): Promise<UserRole[]> => {
  if (!Array.isArray(roleIds)) {
    throw new AppError("ERR_ROLE_IDS_INVALID", 400);
  }

  // Dedupe: roleIds duplicados estourariam o índice único (userId, roleId)
  // de UserRoles depois do destroy — deixando o usuário sem nenhuma role.
  const uniqueRoleIds = Array.from(new Set(roleIds.map(Number)));

  // Requisitante FRESCO do DB — decisões de autorização não confiam no JWT.
  const requestUser = await User.findByPk(requestUserId);
  const isRequestSuper = requestUser?.super === true;

  // SEGURANÇA: usuário alvo confinado à empresa do requisitante; apenas
  // super admin (verificado no DB) pode gerenciar roles cross-tenant.
  const targetUser = await User.findOne({
    where: isRequestSuper ? { id: userId } : { id: userId, companyId }
  });
  if (!targetUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // Daqui em diante tudo opera na empresa do USUÁRIO ALVO — UserRoles são
  // resolvidas por (userId, user.companyId) no resolver de permissões.
  const targetCompanyId = targetUser.companyId;

  const adminRole = await Role.findOne({
    where: { name: ADMIN_ROLE_NAME, companyId: targetCompanyId }
  });

  // SEGURANÇA (N2): a role "Administrador" carrega o catálogo completo de
  // admin — concessão explícita restrita a super admin (mesmo gate do
  // profile="admin" em CreateUserService/UpdateUserService).
  if (adminRole && uniqueRoleIds.includes(adminRole.id) && !isRequestSuper) {
    throw new AppError(
      "ERR_NO_PERMISSION - SOMENTE SUPER ADMIN PODE CONCEDER ADMIN",
      403
    );
  }

  // Alvo admin sempre mantém a role de sistema — não é concessão nova, é
  // preservação do conjunto que o profile já delega (evita rebaixamento
  // silencioso ao salvar o modal de usuário).
  const keepAdminRole =
    targetUser.profile === "admin" &&
    adminRole &&
    !uniqueRoleIds.includes(adminRole.id);
  let effectiveRoleIds = keepAdminRole
    ? [...uniqueRoleIds, adminRole.id]
    : uniqueRoleIds;

  if (effectiveRoleIds.length > 0) {
    const validRoles = await Role.findAll({
      where: { id: effectiveRoleIds, companyId: targetCompanyId }
    });
    if (validRoles.length !== effectiveRoleIds.length) {
      throw new AppError("ERR_ROLE_NOT_FOUND", 404);
    }
  }

  const created = await sequelize.transaction(async transaction => {
    await UserRole.destroy({
      where: { userId, companyId: targetCompanyId },
      transaction
    });

    // Edge: empresa criada depois da migration de composição pode não ter a
    // role "Administrador" ainda — garante dentro da transação.
    if (targetUser.profile === "admin" && !adminRole) {
      const ensured = await EnsureAdminRoleService(targetCompanyId, transaction);
      effectiveRoleIds = [...effectiveRoleIds, ensured.id];
    }

    return Promise.all(
      effectiveRoleIds.map(roleId =>
        UserRole.create(
          { userId, roleId, companyId: targetCompanyId } as any,
          { transaction }
        )
      )
    );
  });

  invalidateRolePermissionsCache(Number(userId), targetCompanyId);
  // Também derruba o cache user:{id} do guard (middleware checkPermission),
  // para que a próxima requisição já enxergue o novo conjunto de Roles.
  serviceCache.invalidate(`user:${userId}`);

  return created;
};

export default SetUserRolesService;
