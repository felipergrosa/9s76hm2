import api from "../../services/api";

const useQueueIntegrations = () => {
	const findAll = async () => {
        try {
            const { data } = await api.get("/queueIntegration/");
            return data;
        } catch (err) {
            // 403 = sem permissão integrations.view (admin)
            // Retorna lista vazia silenciosamente
            if (err?.response?.status === 403) {
                return [];
            }
            throw err;
        }
    }

	return { findAll };
};

export default useQueueIntegrations;