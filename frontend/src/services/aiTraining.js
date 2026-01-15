import api from "./api";

// ========== ASSISTENTE DE PROMPT ==========
export const rewritePrompt = async (data) => {
  const response = await api.post("/ai/prompt-assistant/rewrite", data);
  return response.data;
};

export const suggestImprovements = async (data) => {
  const response = await api.post("/ai/prompt-assistant/suggest", data);
  return response.data;
};

export const getPromptVariables = async (agentId) => {
  const response = await api.get("/ai/prompt-assistant/variables", {
    params: { agentId }
  });
  return response.data;
};

// ========== CENÁRIOS DE TESTE ==========
export const createTestScenario = async (data) => {
  const response = await api.post("/ai/test-scenarios", data);
  return response.data;
};

export const listTestScenarios = async (params) => {
  const response = await api.get("/ai/test-scenarios", { params });
  return response.data;
};

export const runTestScenario = async (scenarioId, data) => {
  const response = await api.post(`/ai/test-scenarios/${scenarioId}/run`, data);
  return response.data;
};

export const deleteTestScenario = async (scenarioId) => {
  const response = await api.delete(`/ai/test-scenarios/${scenarioId}`);
  return response.data;
};

export const getTestHistory = async (params) => {
  const response = await api.get("/ai/test-results", { params });
  return response.data;
};

// ========== VERSIONAMENTO DE PROMPT ==========
export const createPromptVersion = async (data) => {
  const response = await api.post("/ai/prompt-versions", data);
  return response.data;
};

export const listPromptVersions = async (params) => {
  const response = await api.get("/ai/prompt-versions", { params });
  return response.data;
};

export const getPromptVersion = async (versionId) => {
  const response = await api.get(`/ai/prompt-versions/${versionId}`);
  return response.data;
};

export const rollbackToVersion = async (versionId) => {
  const response = await api.post(`/ai/prompt-versions/${versionId}/rollback`);
  return response.data;
};

export const compareVersions = async (versionIdA, versionIdB) => {
  const response = await api.get("/ai/prompt-versions/compare", {
    params: { versionIdA, versionIdB }
  });
  return response.data;
};

// ========== ESTATÍSTICAS ==========
export const getTrainingStats = async (params) => {
  const response = await api.get("/ai/training/stats", { params });
  return response.data;
};
