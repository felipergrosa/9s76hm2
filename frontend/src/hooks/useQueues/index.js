import api from "../../services/api";

const useQueues = () => {
	/**
	 * Busca completa de filas (requer permissão queues.view)
	 * Usa: Páginas administrativas, QueueModal
	 */
	const findAll = async (options = {}) => {
		const { onlyWithBot } = options || {};
		try {
			const { data } = await api.get("/queue", {
				params: {
					onlyWithBot: onlyWithBot ? true : undefined
				}
			});
			return data;
		} catch (err) {
			// 403 = sem permissão queues.view (admin)
			// Retorna lista vazia silenciosamente
			if (err?.response?.status === 403) {
				return [];
			}
			throw err;
		}
	}

	/**
	 * Busca simplificada para SELEÇÃO de filas (SEM permissão)
	 * Usa: CampaignModal, TransferTicket, ScheduleModal
	 * Retorna apenas: id, name, color, orderQueue
	 */
	const findAllForSelection = async (options = {}) => {
		const { onlyWithBot } = options || {};
		try {
			const { data } = await api.get("/queue/available", {
				params: {
					onlyWithBot: onlyWithBot ? true : undefined
				}
			});
			return data;
		} catch (err) {
			// Em caso de erro, retorna lista vazia
			console.error("Erro ao buscar filas disponíveis:", err);
			return [];
		}
	}

	return { findAll, findAllForSelection };
};

export default useQueues;
