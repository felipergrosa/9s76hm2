import User from "../../models/User";
import UserRole from "../../models/UserRole";
import Role from "../../models/Role";
import { withCache, serviceCache } from "../../utils/serviceCache";
import {
  AVAILABLE_PERMISSIONS,
  getAdminPermissions,
  getBaseUserPermissions,
  normalizePermissions
} from "./catalog";

/**
 * Resolvedor de permissões.
 *
 * Converte perfil/flags antigas em permissões granulares (fallback de
 * retrocompatibilidade) e une com as permissões vindas de Roles (RBAC)
 * nas versões assíncronas. Extraído de helpers/PermissionAdapter.ts.
 */

/**
 * Base de permissões de usuário NÃO-admin — e também de admin que já tem
 * Roles atribuídas (fase 3: composição de permissões via Roles).
 *
 * Une: permissões básicas + flags legadas + ACL pontual (user.permissions).
 * A ACL pontual é sempre ADITIVA: antes, user.permissions não-vazio
 * SUBSTITUÍA base+flags (early return), o que podia remover permissões
 * implícitas do usuário ao conceder uma permissão avulsa.
 */
const getNonAdminBasePermissions = (user: User): string[] => {
  // User comum: começa com permissões básicas
  const permissions = [...getBaseUserPermissions()];

  // Adiciona permissões baseadas nas flags existentes
  if (user.allTicket === "enable") {
    permissions.push("tickets.update", "tickets.transfer", "tickets.view-all");
  }

  if (user.allowGroup === true) {
    permissions.push("tickets.view-groups");
  }

  if (user.allHistoric === "enabled") {
    permissions.push("tickets.view-all-historic");
  }

  if (user.allUserChat === "enabled") {
    permissions.push("tickets.view-all-users");
  }

  if (user.userClosePendingTicket === "enabled") {
    permissions.push("tickets.close");
  }

  if (user.showDashboard === "enabled") {
    permissions.push("dashboard.view", "reports.view");
  }

  if (user.allowRealTime === "enabled") {
    permissions.push("realtime.view");
  }

  if (user.allowConnections === "enabled") {
    permissions.push("connections.view", "connections.edit");
  }

  // ACL pontual (user.permissions) é UNIDA à base+flags — nunca substitui
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return normalizePermissions([...permissions, ...user.permissions]);
  }

  return permissions;
};

/**
 * Converte perfil e flags antigas em permissões granulares
 * FALLBACK para retrocompatibilidade
 */
export const getUserPermissions = (user: User): string[] => {
  // Se é super admin, adiciona TODAS permissões incluindo super
  if (user.super === true) {
    return [...getAdminPermissions(), ...AVAILABLE_PERMISSIONS.super];
  }

  // ASSIMETRIA sync vs async (fase 3): na resolução ASSÍNCRONA
  // (getUserPermissionsAsync), profile "admin" deixou de ser cobertor
  // automático quando o usuário tem Roles atribuídas — lá o set efetivo é
  // composto via Roles. Aqui não é possível consultar banco (função usada
  // em dezenas de pontos síncronos, ex.: ActionExecutor), então o admin
  // mantém o blanket legado: retorna um SUPERSET rápido e não-autorizativo.
  // O gate real de autorização é sempre a versão assíncrona.
  if (user.profile === "admin") {
    return [...getAdminPermissions()];
  }

  return getNonAdminBasePermissions(user);
};

/**
 * Verifica se usuário tem uma permissão específica
 * Suporta wildcard: "campaigns.*" concede todas permissões de campanhas
 */
export const hasPermission = (user: any | null | undefined, permission: string): boolean => {
  if (!user) return false;

  // Super admin sempre tem todas permissões
  if (user.super === true) {
    return true;
  }

  const userPermissions = getUserPermissions(user as User);

  // Verifica permissão exata
  if (userPermissions.includes(permission)) {
    return true;
  }

  // Verifica wildcards
  return userPermissions.some(p => {
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + ".");
    }
    return false;
  });
};

/**
 * Verifica se usuário tem TODAS as permissões fornecidas
 */
export const hasAllPermissions = (user: User | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Verifica se usuário tem QUALQUER uma das permissões fornecidas
 */
export const hasAnyPermission = (user: User | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * ===== Item 11 do plano: Camada de Role (RBAC) =====
 *
 * As permissões de Role são UNIDAS (nunca substituem) com as permissões já
 * calculadas por getUserPermissions() acima (perfil/flags antigas/ACL pontual
 * via UserGroupPermission). super tem acesso total e não depende de Role;
 * admin sem Roles mantém o blanket legado, mas admin COM Roles atribuídas
 * passa a compor permissões (fase 3 — ver getUserPermissionsAsync).
 *
 * Importante: getUserPermissions()/hasPermission() (síncronas, usadas em
 * dezenas de pontos do código como ActionExecutor) NÃO são alteradas — para
 * não arriscar quebrar nada que já depende delas. As funções abaixo são
 * aditivas/novas e hoje só são usadas no gate real de autorização das rotas
 * (middleware/checkPermission.ts) e na serialização do usuário para o
 * frontend (SerializeUser.ts).
 */

const ROLE_PERMISSIONS_CACHE_TTL = 60000; // 1 minuto, mesmo padrão usado em ListTicketsService

const getRolePermissionsCacheKey = (userId: number, companyId: number): string =>
  `rolePermissions:${userId}:${companyId}`;

/**
 * Informações de Role do usuário (cacheadas juntas sob a mesma chave).
 *
 * hasRoles é derivado do COUNT de UserRoles — NÃO do length de permissions:
 * uma Role atribuída com permissions=[] retorna array vazio, mas conta como
 * "tem role" para a regra de composição do admin (fase 3).
 */
interface UserRoleInfo {
  permissions: string[];
  hasRoles: boolean;
}

const getUserRoleInfo = async (
  userId: number,
  companyId: number
): Promise<UserRoleInfo> => {
  return withCache(
    getRolePermissionsCacheKey(userId, companyId),
    async () => {
      const userRoles = await UserRole.findAll({
        where: { userId, companyId },
        include: [{ model: Role, as: "role" }]
      });

      const permissionsSet = new Set<string>();
      userRoles.forEach(userRole => {
        const role = (userRole as any).role as Role | undefined;
        if (role && Array.isArray(role.permissions)) {
          role.permissions.forEach(p => permissionsSet.add(p));
        }
      });

      return {
        permissions: Array.from(permissionsSet),
        hasRoles: userRoles.length > 0
      };
    },
    ROLE_PERMISSIONS_CACHE_TTL
  );
};

export const getRolePermissionsForUser = async (
  userId: number,
  companyId: number
): Promise<string[]> => {
  const info = await getUserRoleInfo(userId, companyId);
  return info.permissions;
};

/**
 * Invalida o cache de permissões de Role de um usuário. Chamar após
 * atribuir/remover Roles de um usuário ou editar as permissões de uma Role.
 */
export const invalidateRolePermissionsCache = (userId: number, companyId: number): void => {
  serviceCache.invalidate(getRolePermissionsCacheKey(userId, companyId));
};

/**
 * Versão assíncrona de getUserPermissions(), que une as permissões já
 * calculadas com as permissões vindas de Roles atribuídas ao usuário.
 *
 * Fase 3 — composição de permissões:
 *  - super: acesso total, nunca consulta Roles.
 *  - admin SEM nenhuma UserRole: fallback legado — getAdminPermissions()
 *    completo (evita lockout de tenants antigos não migrados).
 *  - admin COM Roles: set efetivo = base não-admin (flags + ACL pontual)
 *    ∪ permissões de todas as UserRoles. O cobertor de admin some.
 *  - não-admin: base não-admin ∪ permissões das Roles.
 */
export const getUserPermissionsAsync = async (user: User): Promise<string[]> => {
  // super sempre tem acesso total — não precisa consultar Roles
  if (user.super === true) {
    return getUserPermissions(user);
  }

  try {
    const roleInfo = await getUserRoleInfo(user.id, user.companyId);

    if (user.profile === "admin") {
      // Fallback legado: admin sem nenhuma Role atribuída mantém o blanket.
      // hasRoles vem do count de UserRoles — uma Role com permissions=[]
      // ainda conta como atribuída (admin fica limitado de propósito).
      if (!roleInfo.hasRoles) {
        return [...getAdminPermissions()];
      }
      return Array.from(
        new Set([...getNonAdminBasePermissions(user), ...roleInfo.permissions])
      );
    }

    const basePermissions = getNonAdminBasePermissions(user);
    if (roleInfo.permissions.length === 0) return basePermissions;
    return Array.from(new Set([...basePermissions, ...roleInfo.permissions]));
  } catch {
    // Falha ao buscar Roles não deve bloquear o usuário das permissões que
    // já tinha — cai na resolução síncrona (para admin, o blanket legado).
    return getUserPermissions(user);
  }
};

/**
 * Versão assíncrona de hasPermission(), considerando também Roles.
 */
export const hasPermissionAsync = async (
  user: any | null | undefined,
  permission: string
): Promise<boolean> => {
  if (!user) return false;

  if (user.super === true) return true;

  const userPermissions = await getUserPermissionsAsync(user as User);

  if (userPermissions.includes(permission)) return true;

  return userPermissions.some(p => {
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + ".");
    }
    return false;
  });
};

/**
 * Versão assíncrona de hasAllPermissions(), considerando também Roles.
 */
export const hasAllPermissionsAsync = async (
  user: User | null | undefined,
  permissions: string[]
): Promise<boolean> => {
  if (!user) return false;
  for (const permission of permissions) {
    if (!(await hasPermissionAsync(user, permission))) return false;
  }
  return true;
};

/**
 * Versão assíncrona de hasAnyPermission(), considerando também Roles.
 */
export const hasAnyPermissionAsync = async (
  user: User | null | undefined,
  permissions: string[]
): Promise<boolean> => {
  if (!user) return false;
  for (const permission of permissions) {
    if (await hasPermissionAsync(user, permission)) return true;
  }
  return false;
};
