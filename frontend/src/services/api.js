import axios from "axios";

const api = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL,
	withCredentials: true,
	timeout: 30000, // 30 segundos de timeout
});

// Interceptor global NÃO-BLOQUEANTE para 403.
// Apenas loga o erro no console — cada componente trata 403 em seu próprio catch.
// Não usa SweetAlert/modal para não bloquear a UI.
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 403) {
			const url = error.config?.url || "unknown";
			// Log desativado - console.warn(`[api] 403 Sem permissão: ${error.config?.method?.toUpperCase()} ${url}`);
		}
		
		// Retry para erros de rede (HTTP/2, timeout, etc.)
		const config = error.config;
		if (!config || config.__isRetry) {
			return Promise.reject(error);
		}
		
		// Retry apenas para erros de rede (não para 4xx/5xx)
		const shouldRetry = !error.response && error.code !== 'ECONNABORTED';
		if (shouldRetry) {
			config.__isRetry = true;
			console.log(`[api] Tentando retry para ${config.url}...`);
			return api(config);
		}
		
		return Promise.reject(error);
	}
);

// Suprime erros 403 do React dev overlay (unhandled promise rejections)
// Componentes que lidam com 403 silenciosamente (catch sem re-throw) não disparam isso,
// mas componentes que não têm catch específico para 403 podem disparar.
if (typeof window !== "undefined") {
	window.addEventListener("unhandledrejection", (event) => {
		const status = event?.reason?.response?.status;
		if (status === 403) {
			// Evita que o React dev overlay mostre o erro
			event.preventDefault();
		}
	});
}

export const openApi = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL
});

export default api;
