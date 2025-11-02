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
    if (permission === "dashboard.view" && user.showDashboard === "enabled") {
      return true;
    }

    if (permission === "reports.view" && user.showDashboard === "enabled") {
      return true;
    }

    if (permission === "realtime.view" && user.allowRealTime === "enabled") {
      return true;
    }

    if (permission.startsWith("connections.") && user.allowConnections === "enabled") {
      return true;
    }

    if (permission.startsWith("tickets.") && user.allTicket === "enable") {
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
