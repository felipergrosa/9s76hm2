import api from "../../services/api";

const useQueues = () => {
	const findAll = async (options = {}) => {
		const { onlyWithBot } = options || {};
		const { data } = await api.get("/queue", {
			params: {
				onlyWithBot: onlyWithBot ? true : undefined
			}
		});
		return data;
	}

	return { findAll };
};

export default useQueues;
