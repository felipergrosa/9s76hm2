import { useContext } from 'react';
import { AuthContext } from '../context/Auth/AuthContext';

/**
 * Hook para verificar permissões do usuário logado
 * Compatível com sistema antigo (profile) e novo (permissions)
 */
const usePermissions = () => {
  const { user } = useContext(AuthContext);

  /**
   * Verifica se usuário tem uma permissão específica
   * Suporta wildcard: "campaigns.*" concede todas permissões de campanhas
   * 
   * @param {string} permission - Permissão a verificar (ex: "campaigns.create")
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user) return false;

    // Super admin sempre tem tudo
    if (user.super === true) {
      return true;
    }

    // Se usuário tem array de permissões definido, usa ele
    if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      // Verifica permissão exata
      if (user.permissions.includes(permission)) {
        return true;
      }

      // Verifica wildcards
      return user.permissions.some(p => {
        if (p.endsWith(".*")) {
          const prefix = p.slice(0, -2);
          return permission.startsWith(prefix + ".");
        }
        return false;
      });
    }

    // FALLBACK: usa sistema antigo (profile + flags)
    // Admin tem tudo (exceto super)
    if (user.profile === "admin") {
      // Admin não tem permissões de super (companies, all-connections)
      if (permission.startsWith("companies.") || permission === "all-connections.view") {
        return false;
      }
      return true;
    }

    // FALLBACK: Verifica flags antigas (Sistema Legado)
    // Mapeamento completo: flag legada → permissões granulares equivalentes
    const legacyMap = {
      "dashboard.view": user.showDashboard === "enabled",
      "reports.view": user.showDashboard === "enabled",
      "realtime.view": user.allowRealTime === "enabled",
      "connections.view": user.allowConnections === "enabled",
      "connections.edit": user.allowConnections === "enabled",
      "connections.create": user.allowConnections === "enabled",
      "connections.delete": user.allowConnections === "enabled",
      "tickets.view-all": user.allTicket === "enable",
      "tickets.update": user.allTicket === "enable",
      "tickets.transfer": user.allTicket === "enable",
      "tickets.view-groups": user.allowGroup === true,
      "tickets.view-all-historic": user.allHistoric === "enabled",
      "tickets.view-all-users": user.allUserChat === "enabled",
      "tickets.close": user.userClosePendingTicket === "enabled",
    };

    if (legacyMap[permission] === true) {
      return true;
    }

    return false;
  };

  /**
   * Verifica se usuário tem TODAS as permissões fornecidas
   * 
   * @param {string[]} permissions - Array de permissões
   * @returns {boolean}
   */
  const hasAllPermissions = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.every(permission => hasPermission(permission));
  };

  /**
   * Verifica se usuário tem QUALQUER uma das permissões fornecidas
   * 
   * @param {string[]} permissions - Array de permissões
   * @returns {boolean}
   */
  const hasAnyPermission = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.some(permission => hasPermission(permission));
  };

  /**
   * Verifica se usuário é admin (perfil ou tem todas permissões admin)
   * 
   * @returns {boolean}
   */
  const isAdmin = () => {
    return user?.profile === "admin" || user?.super === true;
  };

  /**
   * Verifica se usuário é super admin
   * 
   * @returns {boolean}
   */
  const isSuper = () => {
    return user?.super === true;
  };

  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isAdmin,
    isSuper,
    user
  };
};

export default usePermissions;
