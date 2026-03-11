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
	const { user } = useContext(AuthContext);

	const hasPermission = (permission) => {
		if (user?.super === true) return true;
		if (user?.profile === "admin") return true;
		return Array.isArray(user?.permissions) && user.permissions.includes(permission);
	};

	const requirePermission = (permission) => {
		if (!hasPermission(permission)) {
			return false;
		}
		return true;
	};

	const getAll = async (companyId) => {
		if (!requirePermission("settings.view")) return null;
		const { data } = await api.request({
			url: `/companySettings/${companyId}`,
			method: "GET",
		});

		return data;
	};

	const get = async (params) => {
		if (!requirePermission("settings.view")) return null;
		const { data } = await api.request({
			url: "/companySettingOne",
			method: "GET",
			params,
		});
		return data;
	};

	const update = async (data) => {
		if (!requirePermission("settings.edit")) return null;
		const { data: responseData } = await api.request({
			url: "/companySettings",
			method: "PUT",
			data,
		});
		return responseData;
	};

	return {
		getAll,
		get,
		update,
	};
};

export default useCompanySettings;