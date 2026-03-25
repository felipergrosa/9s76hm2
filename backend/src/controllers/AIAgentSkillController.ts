/**
 * AIAgentSkillController.ts
 * 
 * Controller para gerenciar skills customizadas de AI Agents
 */

import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import SkillManagerService from "../services/AIAgentServices/SkillManagerService";
import { DEFAULT_SKILLS, SkillCategory, validateSkill } from "../services/IA/AISkill";

// Validação Yup para criação de skill
const createSkillSchema = Yup.object().shape({
  name: Yup.string().required("Nome é obrigatório").min(2).max(50),
  category: Yup.string()
    .oneOf(["communication", "sales", "support", "crm", "routing", "sdr", "rag", "scheduling"])
    .required("Categoria é obrigatória"),
  description: Yup.string().required("Descrição é obrigatória").min(10).max(500),
  triggers: Yup.array()
    .of(
      Yup.object().shape({
        type: Yup.string().oneOf(["intent", "keyword", "entity", "condition"]).required(),
        value: Yup.string().required(),
        weight: Yup.number().min(0).max(1).optional()
      })
    )
    .min(1, "Pelo menos um gatilho é obrigatório")
    .required(),
  examples: Yup.array()
    .of(
      Yup.object().shape({
        user: Yup.string().required(),
        assistant: Yup.string().required(),
        function: Yup.string().optional()
      })
    )
    .min(1, "Pelo menos um exemplo é obrigatório")
    .required(),
  functions: Yup.array().of(Yup.string()).default([]),
  conditions: Yup.array()
    .of(
      Yup.object().shape({
        field: Yup.string().required(),
        operator: Yup.string().oneOf(["exists", "not_exists", "equals", "contains", "gt", "lt"]).required(),
        value: Yup.mixed().optional()
      })
    )
    .optional(),
  priority: Yup.number().min(1).max(10).required("Prioridade é obrigatória"),
  enabled: Yup.boolean().default(true),
  metadata: Yup.object().optional()
});

// Validação para atualização
const updateSkillSchema = Yup.object().shape({
  name: Yup.string().min(2).max(50).optional(),
  category: Yup.string()
    .oneOf(["communication", "sales", "support", "crm", "routing", "sdr", "rag", "scheduling"])
    .optional(),
  description: Yup.string().min(10).max(500).optional(),
  triggers: Yup.array()
    .of(
      Yup.object().shape({
        type: Yup.string().oneOf(["intent", "keyword", "entity", "condition"]).required(),
        value: Yup.string().required(),
        weight: Yup.number().min(0).max(1).optional()
      })
    )
    .min(1)
    .optional(),
  examples: Yup.array()
    .of(
      Yup.object().shape({
        user: Yup.string().required(),
        assistant: Yup.string().required(),
        function: Yup.string().optional()
      })
    )
    .min(1)
    .optional(),
  functions: Yup.array().of(Yup.string()).optional(),
  conditions: Yup.array()
    .of(
      Yup.object().shape({
        field: Yup.string().required(),
        operator: Yup.string().oneOf(["exists", "not_exists", "equals", "contains", "gt", "lt"]).required(),
        value: Yup.mixed().optional()
      })
    )
    .optional(),
  priority: Yup.number().min(1).max(10).optional(),
  enabled: Yup.boolean().optional(),
  metadata: Yup.object().optional()
});

/**
 * Lista todas as skills de um agente (padrão + customizadas)
 * GET /ai-agents/:agentId/skills
 */
export const index = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const { companyId } = req.user as any;

    // Verificar se o agente pertence à empresa
    const skills = await SkillManagerService.listSkillsForAgent(Number(agentId));

    res.json({
      success: true,
      data: {
        default: skills.default,
        custom: skills.custom,
        merged: skills.merged,
        total: skills.merged.length
      }
    });
  } catch (error: any) {
    console.error("[SkillController] Error listing skills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Lista apenas skills padrão (template)
 * GET /ai-skills/default
 */
export const listDefault = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: DEFAULT_SKILLS,
      total: DEFAULT_SKILLS.length
    });
  } catch (error: any) {
    console.error("[SkillController] Error listing default skills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Cria uma nova skill customizada
 * POST /ai-agents/:agentId/skills
 */
export const store = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const { companyId } = req.user as any;

    // Validar entrada
    const validatedData = await createSkillSchema.validate(req.body, { abortEarly: false });

    // Criar skill
    const skill = await SkillManagerService.createSkill({
      agentId: Number(agentId),
      name: validatedData.name,
      category: validatedData.category as SkillCategory,
      description: validatedData.description,
      triggers: validatedData.triggers as any,
      examples: validatedData.examples as any,
      functions: validatedData.functions,
      conditions: validatedData.conditions as any,
      priority: validatedData.priority,
      enabled: validatedData.enabled,
      metadata: validatedData.metadata
    });

    res.status(201).json({
      success: true,
      data: skill,
      message: `Skill "${skill.name}" criada com sucesso`
    });
  } catch (error: any) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({
        success: false,
        error: "Erro de validação",
        details: error.errors
      });
      return;
    }
    console.error("[SkillController] Error creating skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Atualiza uma skill customizada
 * PUT /ai-agents/:agentId/skills/:skillId
 */
export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, skillId } = req.params;

    // Validar entrada
    const validatedData = await updateSkillSchema.validate(req.body, { abortEarly: false });

    // Atualizar skill
    const skill = await SkillManagerService.updateSkill(
      Number(skillId),
      Number(agentId),
      {
        ...validatedData,
        category: validatedData.category as SkillCategory | undefined,
        triggers: validatedData.triggers as any,
        examples: validatedData.examples as any,
        conditions: validatedData.conditions as any
      } as any
    );

    res.json({
      success: true,
      data: skill,
      message: `Skill "${skill.name}" atualizada com sucesso`
    });
  } catch (error: any) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({
        success: false,
        error: "Erro de validação",
        details: error.errors
      });
      return;
    }
    console.error("[SkillController] Error updating skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Remove uma skill customizada
 * DELETE /ai-agents/:agentId/skills/:skillId
 */
export const destroy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, skillId } = req.params;

    await SkillManagerService.deleteSkill(Number(skillId), Number(agentId));

    res.json({
      success: true,
      message: "Skill removida com sucesso"
    });
  } catch (error: any) {
    console.error("[SkillController] Error deleting skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Ativa/desativa uma skill
 * PATCH /ai-agents/:agentId/skills/:skillId/toggle
 */
export const toggle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, skillId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      res.status(400).json({
        success: false,
        error: "Campo 'enabled' é obrigatório e deve ser boolean"
      });
      return;
    }

    const skill = await SkillManagerService.toggleSkill(
      Number(skillId),
      Number(agentId),
      enabled
    );

    res.json({
      success: true,
      data: skill,
      message: `Skill ${enabled ? "ativada" : "desativada"} com sucesso`
    });
  } catch (error: any) {
    console.error("[SkillController] Error toggling skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Duplica uma skill padrão para customização
 * POST /ai-agents/:agentId/skills/fork/:skillName
 */
export const fork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, skillName } = req.params;
    const overrides = req.body;

    const skill = await SkillManagerService.forkDefaultSkill(
      Number(agentId),
      skillName,
      overrides
    );

    res.status(201).json({
      success: true,
      data: skill,
      message: `Skill padrão "${skillName}" duplicada com sucesso`
    });
  } catch (error: any) {
    console.error("[SkillController] Error forking skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Valida uma skill antes de salvar
 * POST /ai-skills/validate
 */
export const validate = async (req: Request, res: Response): Promise<void> => {
  try {
    const skill = req.body;

    const errors = validateSkill(skill);

    // Validar funções referenciadas
    const functionValidation = await SkillManagerService.validateSkillFunctions(skill);

    res.json({
      success: true,
      data: {
        valid: errors.length === 0 && functionValidation.valid,
        errors,
        missingFunctions: functionValidation.missing
      }
    });
  } catch (error: any) {
    console.error("[SkillController] Error validating skill:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Importa skills em massa
 * POST /ai-agents/:agentId/skills/import
 */
export const importSkills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const { skills, overwrite } = req.body;

    if (!Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({
        success: false,
        error: "Array de skills é obrigatório"
      });
      return;
    }

    const result = await SkillManagerService.importSkills(
      Number(agentId),
      skills,
      overwrite === true
    );

    res.json({
      success: true,
      data: result,
      message: `${result.imported} skills importadas`
    });
  } catch (error: any) {
    console.error("[SkillController] Error importing skills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Exporta skills de um agente
 * GET /ai-agents/:agentId/skills/export
 */
export const exportSkills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;

    const skills = await SkillManagerService.exportSkills(Number(agentId));

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="skills-agent-${agentId}.json"`);
    res.send(JSON.stringify(skills, null, 2));
  } catch (error: any) {
    console.error("[SkillController] Error exporting skills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export default {
  index,
  listDefault,
  store,
  update,
  destroy,
  toggle,
  fork,
  validate,
  importSkills,
  exportSkills
};
