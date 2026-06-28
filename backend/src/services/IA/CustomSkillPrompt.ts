/**
 * CustomSkillPrompt.ts
 *
 * Item 9.5 do plano: gera o bloco de prompt para as Skills cadastradas
 * via Skill.ts (model em banco, por companyId/agentId), de forma ADITIVA
 * ao bloco fixo já existente (AISkill.ts/DEFAULT_SKILLS). Quando não há
 * nenhuma Skill ativa cadastrada para a empresa/agente, retorna string
 * vazia — ou seja, comportamento atual do prompt é preservado 1:1.
 */
import Skill from "../../models/Skill";

export const generateCustomSkillsPrompt = (skills: Skill[]): string => {
  if (!skills || skills.length === 0) return "";

  const sections = skills.map(skill => {
    const triggers = (skill.triggers || [])
      .filter(t => t.type === "keyword" || t.type === "intent")
      .map(t => t.value)
      .slice(0, 5);

    const examples = (skill.examples || [])
      .map(e => `  Cliente: "${e.user}"\n  Você: "${e.assistant}"${e.function ? ` [${e.function}]` : ""}`)
      .join("\n");

    const functions = skill.functions && skill.functions.length > 0
      ? `\n  Funções disponíveis: ${skill.functions.join(", ")}`
      : "";

    const conditions = skill.conditions && skill.conditions.length > 0
      ? `\n  Condições: ${skill.conditions.map(c => `${c.field} ${c.operator}`).join(", ")}`
      : "";

    return `### ${(skill.name || "").toUpperCase()}
${skill.description || ""}
  Gatilhos: ${triggers.join(", ")}${functions}${conditions}${examples ? `\n  Exemplos:\n${examples}` : ""}`;
  });

  return `
# SKILLS PERSONALIZADAS DA EMPRESA

Além das skills padrão acima, você também possui estas skills configuradas especificamente para este atendimento:

${sections.join("\n\n")}
`;
};

export default generateCustomSkillsPrompt;
