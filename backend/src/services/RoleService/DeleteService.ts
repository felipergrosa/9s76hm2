import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import User from "../../models/User";
import UserRole from "../../models/UserRole";
import { serviceCache } from "../../utils/serviceCache";
import { invalidateRolePermissionsCache } from "../../helpers/PermissionAdapter";
import { ADMIN_ROLE_NAME } from "./EnsureAdminRoleService";

const DeleteService = async (id: string | number, companyId: number): Promise<void> => {
  const role = await Role.findOne({ where: { id, companyId } });

  if (!role) {
    throw new AppError("ERR_ROLE_NOT_FOUND", 404);
  }

  const userRoles = await UserRole.findAll({ where: { roleId: role.id, companyId } });

  // Fase 3 (composição de permissões): a Role de sistema "Administrador"
  // carrega os poderes dos admins. Bloqueia a exclusão enquanto houver
  // usuário com profile="admin" vinculado a ela — remover a Role deixaria
  // esses admins no fallback legado de blanket total (sem granularidade),
  // além de ser uma alteração de privilégio implícita. Primeiro é preciso
  // rebaixar o profile ou reatribuir os admins a outra Role.
  if (role.name === ADMIN_ROLE_NAME && userRoles.length > 0) {
    const adminsLinked = await User.count({
      where: {
        id: userRoles.map(ur => ur.userId),
        companyId,
        profile: "admin"
      }
    });
    if (adminsLinked > 0) {
      throw new AppError(
        "Não é possível excluir a role 'Administrador': há administradores vinculados a ela. Rebaixe o perfil ou reatribua os admins antes.",
        400
      );
    }
  }

  await role.destroy(); // UserRoles são removidos em cascata (FK onDelete CASCADE)

  userRoles.forEach(ur => {
    invalidateRolePermissionsCache(ur.userId, companyId);
    // Também derruba o cache user:{id} do guard (middleware checkPermission)
    serviceCache.invalidate(`user:${ur.userId}`);
  });
};

export default DeleteService;
