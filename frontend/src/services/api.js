import axios from "axios";
import Swal from "sweetalert2";

// Flag para evitar múltiplos modais de permissão simultâneos
let isPermissionModalOpen = false;

const api = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL,
	withCredentials: true,
});

api.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		if (error.response && error.response.status === 403) {
			// Evita abrir múltiplos modais simultaneamente
			if (!isPermissionModalOpen) {
				isPermissionModalOpen = true;
				Swal.fire({
					icon: "error",
					title: "Sem Permissão",
					text: "Você não tem permissão para realizar esta ação ou acessar este recurso.",
					confirmButtonColor: "#d33",
					confirmButtonText: "OK",
				}).then(() => {
					isPermissionModalOpen = false;
				});
			}
		}
		return Promise.reject(error);
	}
);

export const openApi = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL
});

export default api;
