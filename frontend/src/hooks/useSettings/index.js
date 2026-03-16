import { useContext } from "react";
import api, { openApi } from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useSettings = () => {
  // Permite usar sem AuthProvider (para getPublicSetting no App.js)
  const context = useContext(AuthContext);
  const user = context?.user;

  // Verificação de permissão
  const checkPermission = (permission) => {
    // Se não tem contexto ainda, retorna false (não tem permissão)
    if (!user) return false;
    
    if (user?.super === true) return true;
    if (user?.profile === "admin") return true;
    
    if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
      if (user.permissions.includes(permission)) return true;
      return user.permissions.some(p => {
        if (p.endsWith(".*")) {
          const prefix = p.slice(0, -2);
          return permission.startsWith(prefix + ".");
        }
        return false;
      });
    }
    
    return false;
  };

  const getAll = async (params) => {
    // Verifica permissão ANTES de fazer a chamada
    if (!checkPermission("settings.view")) {
      return null;
    }
    
    try {
      const { data } = await api.request({
        url: "/settings",
        method: "GET",
        params,
      });
      return data;
    } catch (err) {
      // Silencia erro 403
      if (err?.response?.status !== 403) {
        console.error("[useSettings] Erro ao buscar configurações:", err);
      }
      return null;
    }
  };

  const update = async (data) => {
    // Verifica permissão ANTES de fazer a chamada
    if (!checkPermission("settings.edit")) {
      return null;
    }
    
    try {
      const { data: responseData } = await api.request({
        url: `/settings/${data.key}`,
        method: "PUT",
        data,
      });
      return responseData;
    } catch (err) {
      // Silencia erro 403
      if (err?.response?.status !== 403) {
        console.error("[useSettings] Erro ao atualizar configuração:", err);
      }
      return null;
    }
  };

  const get = async (param) => {
    // Verifica permissão ANTES de fazer a chamada
    if (!checkPermission("settings.view")) {
      return null;
    }
    
    try {
      const { data } = await api.request({
        url: `/setting/${param}`,
        method: "GET",
      });
      return data;
    } catch (err) {
      // Silencia erro 403
      if (err?.response?.status !== 403) {
        console.error("[useSettings] Erro ao buscar configuração:", err);
      }
      return null;
    }
  };

  const getPublicSetting = async (key) => {
    // Endpoint público - não requer permissão nem AuthContext
    const params = {
      token: "wtV"
    }

    try {
      const { data } = await openApi.request({
        url: `/public-settings/${key}`,
        method: 'GET',
        params
      });
      return data;
    } catch (err) {
      console.error("[useSettings] Erro ao buscar configuração pública:", err);
      return null;
    }
  };

  return {
    getAll,
    update,
    get,
    getPublicSetting,
    checkPermission,
  };
};

export default useSettings;
