/** 
 * @TercioSantos-1 |
 * api/get/todas as configurações de 1 empresa |
 * api/get/1 configuração específica |
 * api/put/atualização de 1 configuração |
 */
import { useContext } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useCompanySettings = () => {
	// Permite usar sem AuthProvider estar carregado
	const context = useContext(AuthContext);
	const user = context?.user;

	// Verificação centralizada de permissão
	const checkPermission = (permission) => {
		// Se não tem contexto/usuário ainda, retorna false
		if (!user) return false;
		
		// Super admin sempre tem tudo
		if (user?.super === true) return true;
		
		// Admin tem acesso a settings
		if (user?.profile === "admin") return true;
		
		// Verifica se tem a permissão específica no array
		if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
			// Verifica permissão exata
			if (user.permissions.includes(permission)) return true;
			
			// Verifica wildcards (ex: settings.* concede settings.view)
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

	const getAll = async (companyId) => {
		// Verifica permissão ANTES de fazer a chamada
		if (!checkPermission("settings.view")) {
			console.log("[useCompanySettings] Usuário sem permissão settings.view, retornando null");
			return null;
		}
		
		try {
			const { data } = await api.request({
				url: `/companySettings/${companyId}`,
				method: "GET",
			});
			return data;
		} catch (err) {
			// Silencia erro 403 (sem permissão)
			if (err?.response?.status !== 403) {
				console.error("[useCompanySettings] Erro ao buscar configurações:", err);
			}
			return null;
		}
	};

	const get = async (params) => {
		// Verifica permissão ANTES de fazer a chamada
		if (!checkPermission("settings.view")) {
			console.log("[useCompanySettings] Usuário sem permissão settings.view, retornando null");
			return null;
		}
		
		try {
			const { data } = await api.request({
				url: "/companySettingOne",
				method: "GET",
				params,
			});
			return data;
		} catch (err) {
			// Silencia erro 403 (sem permissão)
			if (err?.response?.status !== 403) {
				console.error("[useCompanySettings] Erro ao buscar configuração:", err);
			}
			return null;
		}
	};

	const update = async (data) => {
		// Verifica permissão ANTES de fazer a chamada
		if (!checkPermission("settings.edit")) {
			console.log("[useCompanySettings] Usuário sem permissão settings.edit, retornando null");
			return null;
		}
		
		try {
			const { data: responseData } = await api.request({
				url: "/companySettings",
				method: "PUT",
				data,
			});
			return responseData;
		} catch (err) {
			// Silencia erro 403 (sem permissão)
			if (err?.response?.status !== 403) {
				console.error("[useCompanySettings] Erro ao atualizar configuração:", err);
			}
			return null;
		}
	};

	return {
		getAll,
		get,
		update,
		checkPermission, // Exporta para componentes que precisam verificar
	};
};

export default useCompanySettings;