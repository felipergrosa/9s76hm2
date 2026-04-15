/**
 * skills.js
 * 
 * API service para gerenciamento de Skills
 */

import api from "./api";

/**
 * Listar todas as skills
 */
export const listSkills = async (params = {}) => {
  const { data } = await api.get("/skills", { params });
  return data;
};

/**
 * Buscar skill específica
 */
export const getSkill = async (id) => {
  const { data } = await api.get(`/skills/${id}`);
  return data;
};

/**
 * Criar nova skill
 */
export const createSkill = async (skillData) => {
  const { data } = await api.post("/skills", skillData);
  return data;
};

/**
 * Atualizar skill
 */
export const updateSkill = async (id, skillData) => {
  const { data } = await api.put(`/skills/${id}`, skillData);
  return data;
};

/**
 * Deletar skill
 */
export const deleteSkill = async (id) => {
  const { data } = await api.delete(`/skills/${id}`);
  return data;
};

/**
 * Duplicar skill (fork)
 */
export const forkSkill = async (id, agentId) => {
  const { data } = await api.post(`/skills/${id}/fork`, { agentId });
  return data;
};

/**
 * Ativar/Desativar skill
 */
export const toggleSkill = async (id) => {
  const { data } = await api.patch(`/skills/${id}/toggle`);
  return data;
};

/**
 * Publicar skill
 */
export const publishSkill = async (id) => {
  const { data } = await api.post(`/skills/${id}/publish`);
  return data;
};

/**
 * Validar skill
 */
export const validateSkill = async (skillData) => {
  const { data } = await api.post("/skills/validate", skillData);
  return data;
};

/**
 * Importar skills em massa
 */
export const importSkills = async (skills, agentId) => {
  const { data } = await api.post("/skills/import", { skills, agentId });
  return data;
};

/**
 * Exportar skills
 */
export const exportSkills = async (params = {}) => {
  const { data } = await api.get("/skills/export", { params });
  return data;
};

/**
 * Estatísticas do cache
 */
export const getCacheStats = async () => {
  const { data } = await api.get("/skills/cache/stats");
  return data;
};
