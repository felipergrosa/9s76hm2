import api from "./api";

export const getAIAgents = async () => {
    const { data } = await api.get("/ai-agents");
    return data;
};

export const getAIAgent = async (id) => {
    const { data } = await api.get(`/ai-agents/${id}`);
    return data;
};

export const createAIAgent = async (agentData) => {
    const { data } = await api.post("/ai-agents", agentData);
    return data;
};

export const updateAIAgent = async (id, agentData) => {
    const { data } = await api.put(`/ai-agents/${id}`, agentData);
    return data;
};

export const deleteAIAgent = async (id) => {
    const { data } = await api.delete(`/ai-agents/${id}`);
    return data;
};
