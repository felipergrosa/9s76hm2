/**
 * SkillManagerService.ts
 * 
 * Serviço para gerenciar skills customizadas por agente
 * Permite CRUD completo e mesclagem com skills padrão
 */

import AIAgentSkill from "../../models/AIAgentSkill";
import AIAgent from "../../models/AIAgent";
import { DEFAULT_SKILLS, AISkill, generateSkillsPrompt, validateSkill, SkillCategory } from "../IA/AISkill";
import { Op } from "sequelize";

interface CreateSkillData {
  agentId: number;
  name: string;
  category: SkillCategory;
  description: string;
  triggers: AISkill["triggers"];
  examples: AISkill["examples"];
  functions: string[];
  conditions?: AISkill["conditions"];
  priority: number;
  enabled?: boolean;
  metadata?: AISkill["metadata"];
}

interface UpdateSkillData extends Partial<CreateSkillData> {}

/**
 * Lista todas as skills de um agente (padrão + customizadas)
 */
export const listSkillsForAgent = async (agentId: number): Promise<{
  default: AISkill[];
  custom: AIAgentSkill[];
  merged: AISkill[];
}> => {
  // Buscar skills customizadas do agente
  const customSkills = await AIAgentSkill.findAll({
    where: { agentId },
    order: [["priority", "DESC"], ["name", "ASC"]]
  });

  // Skills padrão que não foram sobrescritas
  const customNames = customSkills.map(s => s.name.toLowerCase());
  const defaultNotOverridden = DEFAULT_SKILLS.filter(
    s => !customNames.includes(s.name.toLowerCase())
  );

  // Converter customSkills para formato AISkill
  const customAsAISkill: AISkill[] = customSkills.map(s => ({
    name: s.name,
    category: s.category as SkillCategory,
    description: s.description,
    triggers: s.triggers as AISkill["triggers"],
    examples: s.examples as AISkill["examples"],
    functions: s.functions,
    conditions: s.conditions as AISkill["conditions"],
    priority: s.priority,
    enabled: s.enabled,
    metadata: s.metadata
  }));

  // Merge: custom tem prioridade sobre default
  const merged = [...customAsAISkill, ...defaultNotOverridden].sort(
    (a, b) => b.priority - a.priority
  );

  return {
    default: DEFAULT_SKILLS,
    custom: customSkills,
    merged
  };
};

/**
 * Cria uma nova skill customizada para um agente
 */
export const createSkill = async (data: CreateSkillData): Promise<AIAgentSkill> => {
  // Verificar se agente existe
  const agent = await AIAgent.findByPk(data.agentId);
  if (!agent) {
    throw new Error("Agente não encontrado");
  }

  // Validar skill
  const skillToValidate: AISkill = {
    name: data.name,
    category: data.category,
    description: data.description,
    triggers: data.triggers,
    examples: data.examples,
    functions: data.functions,
    conditions: data.conditions,
    priority: data.priority,
    enabled: data.enabled ?? true
  };

  const errors = validateSkill(skillToValidate);
  if (errors.length > 0) {
    throw new Error(`Validação falhou: ${errors.join(", ")}`);
  }

  // Verificar se já existe skill com mesmo nome para este agente
  const existing = await AIAgentSkill.findOne({
    where: { agentId: data.agentId, name: { [Op.iLike]: data.name } }
  });

  if (existing) {
    throw new Error(`Já existe uma skill "${data.name}" para este agente`);
  }

  // Criar skill
  const skill = await AIAgentSkill.create({
    ...data,
    enabled: data.enabled ?? true,
    metadata: {
      ...data.metadata,
      createdAt: new Date().toISOString()
    }
  });

  console.log(`[SkillManager] Skill "${data.name}" criada para agente ${data.agentId}`);

  return skill;
};

/**
 * Atualiza uma skill customizada
 */
export const updateSkill = async (
  skillId: number,
  agentId: number,
  data: UpdateSkillData
): Promise<AIAgentSkill> => {
  const skill = await AIAgentSkill.findOne({
    where: { id: skillId, agentId }
  });

  if (!skill) {
    throw new Error("Skill não encontrada");
  }

  // Validar se houver mudanças estruturais
  if (data.triggers || data.examples || data.functions) {
    const skillToValidate: AISkill = {
      name: data.name || skill.name,
      category: (data.category as SkillCategory) || (skill.category as SkillCategory),
      description: data.description || skill.description,
      triggers: data.triggers || (skill.triggers as AISkill["triggers"]),
      examples: data.examples || (skill.examples as AISkill["examples"]),
      functions: data.functions || skill.functions,
      conditions: data.conditions || (skill.conditions as AISkill["conditions"]),
      priority: data.priority ?? skill.priority,
      enabled: data.enabled ?? skill.enabled
    };

    const errors = validateSkill(skillToValidate);
    if (errors.length > 0) {
      throw new Error(`Validação falhou: ${errors.join(", ")}`);
    }
  }

  // Atualizar campos
  await skill.update({
    ...data,
    metadata: {
      ...skill.metadata,
      updatedAt: new Date().toISOString()
    }
  });

  console.log(`[SkillManager] Skill "${skill.name}" atualizada`);

  return skill;
};

/**
 * Remove uma skill customizada
 */
export const deleteSkill = async (skillId: number, agentId: number): Promise<void> => {
  const skill = await AIAgentSkill.findOne({
    where: { id: skillId, agentId }
  });

  if (!skill) {
    throw new Error("Skill não encontrada");
  }

  await skill.destroy();

  console.log(`[SkillManager] Skill "${skill.name}" removida`);
};

/**
 * Ativa/desativa uma skill
 */
export const toggleSkill = async (
  skillId: number,
  agentId: number,
  enabled: boolean
): Promise<AIAgentSkill> => {
  const skill = await AIAgentSkill.findOne({
    where: { id: skillId, agentId }
  });

  if (!skill) {
    throw new Error("Skill não encontrada");
  }

  await skill.update({ enabled });

  console.log(`[SkillManager] Skill "${skill.name}" ${enabled ? "ativada" : "desativada"}`);

  return skill;
};

/**
 * Duplica uma skill padrão para customização
 */
export const forkDefaultSkill = async (
  agentId: number,
  skillName: string,
  overrides?: Partial<CreateSkillData>
): Promise<AIAgentSkill> => {
  const defaultSkill = DEFAULT_SKILLS.find(
    s => s.name.toLowerCase() === skillName.toLowerCase()
  );

  if (!defaultSkill) {
    throw new Error(`Skill padrão "${skillName}" não encontrada`);
  }

  // Criar versão customizada
  const customSkill = await createSkill({
    agentId,
    name: overrides?.name || defaultSkill.name,
    category: overrides?.category || defaultSkill.category,
    description: overrides?.description || defaultSkill.description,
    triggers: overrides?.triggers || defaultSkill.triggers,
    examples: overrides?.examples || defaultSkill.examples,
    functions: overrides?.functions || defaultSkill.functions,
    conditions: overrides?.conditions || defaultSkill.conditions,
    priority: overrides?.priority || defaultSkill.priority,
    enabled: overrides?.enabled ?? true,
    metadata: {
      ...defaultSkill.metadata,
      version: `fork-${Date.now()}`
    }
  });

  console.log(`[SkillManager] Skill padrão "${skillName}" duplicada para agente ${agentId}`);

  return customSkill;
};

/**
 * Gera prompt de skills para um agente específico
 */
export const generateAgentSkillsPrompt = async (agentId: number): Promise<string> => {
  const { merged } = await listSkillsForAgent(agentId);
  return generateSkillsPrompt(merged);
};

/**
 * Valida se as funções referenciadas nas skills existem
 */
export const validateSkillFunctions = async (skill: AISkill): Promise<{
  valid: boolean;
  missing: string[];
}> => {
  const { BOT_AVAILABLE_FUNCTIONS } = await import("../IA/BotFunctions");
  const availableFunctions = BOT_AVAILABLE_FUNCTIONS.map(f => f.name);

  const missing = skill.functions.filter(f => !availableFunctions.includes(f));

  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Importa skills em massa (de template ou backup)
 */
export const importSkills = async (
  agentId: number,
  skills: AISkill[],
  overwrite: boolean = false
): Promise<{ imported: number; skipped: number; errors: string[] }> => {
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const skill of skills) {
    try {
      // Verificar se já existe
      const existing = await AIAgentSkill.findOne({
        where: { agentId, name: { [Op.iLike]: skill.name } }
      });

      if (existing && !overwrite) {
        result.skipped++;
        continue;
      }

      if (existing && overwrite) {
        await existing.update({
          category: skill.category,
          description: skill.description,
          triggers: skill.triggers,
          examples: skill.examples,
          functions: skill.functions,
          conditions: skill.conditions,
          priority: skill.priority,
          enabled: skill.enabled,
          metadata: {
            ...skill.metadata,
            importedAt: new Date().toISOString()
          }
        });
        result.imported++;
      } else {
        await createSkill({
          agentId,
          ...skill
        });
        result.imported++;
      }
    } catch (error: any) {
      result.errors.push(`${skill.name}: ${error.message}`);
    }
  }

  console.log(`[SkillManager] Importação concluída: ${result.imported} importadas, ${result.skipped} ignoradas`);

  return result;
};

/**
 * Exporta skills de um agente (para backup ou template)
 */
export const exportSkills = async (agentId: number): Promise<AISkill[]> => {
  const { custom } = await listSkillsForAgent(agentId);

  return custom.map(s => ({
    name: s.name,
    category: s.category as SkillCategory,
    description: s.description,
    triggers: s.triggers as AISkill["triggers"],
    examples: s.examples as AISkill["examples"],
    functions: s.functions,
    conditions: s.conditions as AISkill["conditions"],
    priority: s.priority,
    enabled: s.enabled,
    metadata: s.metadata
  }));
};

export default {
  listSkillsForAgent,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkill,
  forkDefaultSkill,
  generateAgentSkillsPrompt,
  validateSkillFunctions,
  importSkills,
  exportSkills
};
