/**
 * SkillController.ts
 * 
 * Controller REST para gerenciamento de Skills
 * Integrado com WebSocket para notificações em tempo real
 */

import { Request, Response } from "express";
import Skill from "../models/Skill";
import { skillWebSocket } from "../services/IA/SkillWebSocketService";
import { skillCache } from "../services/IA/SkillCacheService";
import logger from "../utils/logger";

interface CreateSkillRequest {
  name: string;
  category?: string;
  description: string;
  triggers: any[];
  examples?: any[];
  functions?: string[];
  conditions?: any[];
  priority?: number;
  agentId?: number;
  metadata?: any;
}

interface UpdateSkillRequest {
  name?: string;
  category?: string;
  description?: string;
  triggers?: any[];
  examples?: any[];
  functions?: string[];
  conditions?: any[];
  priority?: number;
  enabled?: boolean;
  status?: "draft" | "active" | "deprecated";
  metadata?: any;
}

// Criar nova skill
export const create = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    name,
    category,
    description,
    triggers,
    examples,
    functions,
    conditions,
    priority,
    agentId,
    metadata
  }: CreateSkillRequest = req.body;

  try {
    // Validar campos obrigatórios
    if (!name || !description || !triggers || triggers.length === 0) {
      return res.status(400).json({
        error: "Nome, descrição e pelo menos um gatilho são obrigatórios"
      });
    }

    const skill = await Skill.create({
      companyId,
      agentId: agentId || null,
      name,
      category: category || "custom",
      description,
      triggers,
      examples: examples || [],
      functions: functions || [],
      conditions: conditions || [],
      priority: priority || 5,
      enabled: true,
      status: "draft",
      metadata: metadata || {}
    });

    // Notificar via WebSocket
    skillWebSocket.notifyCreated(skill);

    logger.info(`[SkillController] Skill criada: ${skill.id} - ${skill.name}`);

    return res.status(201).json({
      skill: skill.toJSON(),
      message: "Skill criada com sucesso"
    });
  } catch (error) {
    logger.error("[SkillController] Erro ao criar skill:", error);
    return res.status(500).json({ error: "Erro ao criar skill" });
  }
};

// Listar skills
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, category, status, enabled } = req.query;

  try {
    const where: any = { companyId };

    if (agentId) where.agentId = agentId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (enabled !== undefined) where.enabled = enabled === "true";

    const skills = await Skill.findAll({
      where,
      order: [
        ["priority", "DESC"],
        ["updatedAt", "DESC"]
      ]
    });

    return res.json({
      skills,
      count: skills.length,
      cacheStats: skillCache.getStats()
    });
  } catch (error) {
    logger.error("[SkillController] Erro ao listar skills:", error);
    return res.status(500).json({ error: "Erro ao listar skills" });
  }
};

// Buscar skill específica
export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const skill = await Skill.findOne({
      where: { id, companyId }
    });

    if (!skill) {
      return res.status(404).json({ error: "Skill não encontrada" });
    }

    return res.json({ skill });
  } catch (error) {
    logger.error("[SkillController] Erro ao buscar skill:", error);
    return res.status(500).json({ error: "Erro ao buscar skill" });
  }
};

// Atualizar skill
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const updates: UpdateSkillRequest = req.body;

  try {
    const skill = await Skill.findOne({
      where: { id, companyId }
    });

    if (!skill) {
      return res.status(404).json({ error: "Skill não encontrada" });
    }

    // Registrar mudanças para notificação
    const changes: string[] = [];
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && JSON.stringify(updates[key]) !== JSON.stringify(skill[key])) {
        changes.push(key);
      }
    });

    // Atualizar versão se houver mudanças significativas
    if (changes.some(c => ["triggers", "functions", "conditions", "description"].includes(c))) {
      skill.bumpVersion("patch");
    }

    await skill.update(updates);

    // Notificar via WebSocket
    skillWebSocket.notifyUpdated(skill, changes);

    logger.info(`[SkillController] Skill atualizada: ${skill.id}, mudanças: ${changes.join(", ")}`);

    return res.json({
      skill: skill.toJSON(),
      changes,
      message: "Skill atualizada com sucesso"
    });
  } catch (error) {
    logger.error("[SkillController] Erro ao atualizar skill:", error);
    return res.status(500).json({ error: "Erro ao atualizar skill" });
  }
};

// Deletar skill
export const destroy = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const skill = await Skill.findOne({
      where: { id, companyId }
    });

    if (!skill) {
      return res.status(404).json({ error: "Skill não encontrada" });
    }

    // Soft delete - mudar status para deprecated
    await skill.update({ status: "deprecated", enabled: false });

    // Notificar via WebSocket
    skillWebSocket.notifyDeleted(skill);

    logger.info(`[SkillController] Skill deletada: ${skill.id}`);

    return res.json({ message: "Skill removida com sucesso" });
  } catch (error) {
    logger.error("[SkillController] Erro ao deletar skill:", error);
    return res.status(500).json({ error: "Erro ao deletar skill" });
  }
};

// Duplicar skill (fork)
export const fork = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const { agentId } = req.body;

  try {
    const original = await Skill.findOne({
      where: { id, companyId }
    });

    if (!original) {
      return res.status(404).json({ error: "Skill original não encontrada" });
    }

    const forked = await Skill.create({
      companyId,
      agentId: agentId || original.agentId,
      name: `${original.name} (cópia)`,
      category: original.category,
      description: original.description,
      triggers: original.triggers,
      examples: original.examples,
      functions: original.functions,
      conditions: original.conditions,
      priority: original.priority,
      enabled: false, // Inicia desabilitada
      status: "draft",
      version: "1.0.0",
      metadata: {
        ...original.metadata,
        forkedFrom: original.id,
        forkedAt: new Date().toISOString()
      }
    });

    skillWebSocket.notifyCreated(forked);

    logger.info(`[SkillController] Skill forked: ${original.id} -> ${forked.id}`);

    return res.status(201).json({
      skill: forked.toJSON(),
      message: "Skill duplicada com sucesso"
    });
  } catch (error) {
    logger.error("[SkillController] Erro ao fazer fork:", error);
    return res.status(500).json({ error: "Erro ao duplicar skill" });
  }
};

// Ativar/Desativar skill (toggle)
export const toggle = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const skill = await Skill.findOne({
      where: { id, companyId }
    });

    if (!skill) {
      return res.status(404).json({ error: "Skill não encontrada" });
    }

    const newEnabled = !skill.enabled;
    await skill.update({ enabled: newEnabled });

    skillWebSocket.notifyUpdated(skill, ["enabled"]);

    return res.json({
      skill: skill.toJSON(),
      message: `Skill ${newEnabled ? "ativada" : "desativada"} com sucesso`
    });
  } catch (error) {
    logger.error("[SkillController] Erro no toggle:", error);
    return res.status(500).json({ error: "Erro ao alterar status da skill" });
  }
};

// Publicar skill (mudar status de draft para active)
export const publish = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const skill = await Skill.findOne({
      where: { id, companyId }
    });

    if (!skill) {
      return res.status(404).json({ error: "Skill não encontrada" });
    }

    if (skill.status !== "draft") {
      return res.status(400).json({ error: "Apenas skills em rascunho podem ser publicadas" });
    }

    await skill.update({
      status: "active",
      enabled: true
    });

    skillWebSocket.notifyUpdated(skill, ["status", "enabled"]);

    return res.json({
      skill: skill.toJSON(),
      message: "Skill publicada com sucesso"
    });
  } catch (error) {
    logger.error("[SkillController] Erro ao publicar:", error);
    return res.status(500).json({ error: "Erro ao publicar skill" });
  }
};

// Importar skills em massa
export const importSkills = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { skills, agentId } = req.body;

  try {
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: "Array de skills é obrigatório" });
    }

    const created = [];
    for (const skillData of skills) {
      const skill = await Skill.create({
        companyId,
        agentId: agentId || skillData.agentId || null,
        name: skillData.name,
        category: skillData.category || "custom",
        description: skillData.description,
        triggers: skillData.triggers || [],
        examples: skillData.examples || [],
        functions: skillData.functions || [],
        conditions: skillData.conditions || [],
        priority: skillData.priority || 5,
        enabled: skillData.enabled !== undefined ? skillData.enabled : true,
        status: "draft",
        version: "1.0.0",
        metadata: {
          ...skillData.metadata,
          importedAt: new Date().toISOString()
        }
      });

      created.push(skill);
      skillWebSocket.notifyCreated(skill);
    }

    logger.info(`[SkillController] ${created.length} skills importadas`);

    return res.status(201).json({
      skills: created.map(s => s.toJSON()),
      count: created.length,
      message: `${created.length} skills importadas com sucesso`
    });
  } catch (error) {
    logger.error("[SkillController] Erro na importação:", error);
    return res.status(500).json({ error: "Erro ao importar skills" });
  }
};

// Exportar skills
export const exportSkills = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, category } = req.query;

  try {
    const where: any = { companyId };
    if (agentId) where.agentId = agentId;
    if (category) where.category = category;

    const skills = await Skill.findAll({
      where,
      attributes: { exclude: ["id", "companyId", "agentId", "createdAt", "updatedAt"] }
    });

    return res.json({
      skills,
      count: skills.length,
      exportedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error("[SkillController] Erro na exportação:", error);
    return res.status(500).json({ error: "Erro ao exportar skills" });
  }
};

// Validar skill
export const validate = async (req: Request, res: Response): Promise<Response> => {
  const skillData = req.body;

  const errors: string[] = [];

  if (!skillData.name || skillData.name.trim().length < 2) {
    errors.push("Nome deve ter pelo menos 2 caracteres");
  }

  if (!skillData.description || skillData.description.trim().length < 10) {
    errors.push("Descrição deve ter pelo menos 10 caracteres");
  }

  if (!skillData.triggers || skillData.triggers.length === 0) {
    errors.push("Pelo menos um gatilho é obrigatório");
  } else {
    skillData.triggers.forEach((trigger: any, idx: number) => {
      if (!trigger.type || !trigger.value) {
        errors.push(`Gatilho ${idx + 1}: tipo e valor são obrigatórios`);
      }
    });
  }

  if (skillData.priority !== undefined && (skillData.priority < 1 || skillData.priority > 10)) {
    errors.push("Prioridade deve estar entre 1 e 10");
  }

  const isValid = errors.length === 0;

  return res.json({
    valid: isValid,
    errors,
    warnings: [] // TODO: adicionar warnings
  });
};

// Estatísticas do cache
export const cacheStats = async (req: Request, res: Response): Promise<Response> => {
  return res.json({
    cache: skillCache.getStats(),
    websocket: skillWebSocket.getStats()
  });
};
