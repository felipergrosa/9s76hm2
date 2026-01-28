import axios from "axios";
import Swal from "sweetalert2";

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
			Swal.fire({
				icon: "error",
				title: "Sem Permissão",
				text: "Você não tem permissão para realizar esta ação ou acessar este recurso.",
				confirmButtonColor: "#d33",
				confirmButtonText: "OK",
			});
		}
		return Promise.reject(error);
	}
);

export const openApi = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL
});

export default api;
