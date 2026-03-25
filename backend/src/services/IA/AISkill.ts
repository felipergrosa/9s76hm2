/**
 * AISkill.ts
 * 
 * Sistema de Skills para AI Agents
 * Uma "skill" é uma capacidade estruturada que o agente pode usar
 * 
 * Estrutura:
 * - name: Identificador único
 * - category: Grupo de skills relacionadas
 * - description: O que a skill faz
 * - triggers: Palavras/frases que ativam a skill
 * - examples: Exemplos de uso para o prompt
 * - functions: Funções do BotFunctions relacionadas
 * - conditions: Condições para usar a skill
 * - priority: Prioridade quando múltiplas skills aplicam
 */

export type SkillCategory = 
  | "communication"   // Saudações, despedidas, agradecimentos
  | "sales"           // Vendas, catálogos, tabelas
  | "support"         // Suporte, dúvidas, problemas
  | "crm"             // Cadastro, atualização de dados
  | "routing"         // Transferência, escalonamento
  | "sdr"             // Qualificação de leads
  | "rag"             // Busca em base de conhecimento
  | "scheduling";     // Agendamentos

export interface SkillTrigger {
  type: "intent" | "keyword" | "entity" | "condition";
  value: string;
  weight?: number; // 0-1, importância do gatilho
}

export interface SkillExample {
  user: string;
  assistant: string;
  function?: string;
}

export interface SkillCondition {
  field: string;
  operator: "exists" | "not_exists" | "equals" | "contains" | "gt" | "lt";
  value?: any;
}

export interface AISkill {
  name: string;
  category: SkillCategory;
  description: string;
  triggers: SkillTrigger[];
  examples: SkillExample[];
  functions: string[];
  conditions?: SkillCondition[];
  priority: number; // 1-10, maior = mais prioridade
  enabled: boolean;
  metadata?: {
    version?: string;
    author?: string;
    tags?: string[];
  };
}

/**
 * Skills padrão disponíveis para todos os agentes
 */
export const DEFAULT_SKILLS: AISkill[] = [
  // ========== COMMUNICATION ==========
  {
    name: "greeting",
    category: "communication",
    description: "Cumprimenta o cliente de forma calorosa e profissional",
    triggers: [
      { type: "intent", value: "greeting", weight: 1 },
      { type: "keyword", value: "oi", weight: 0.8 },
      { type: "keyword", value: "olá", weight: 0.8 },
      { type: "keyword", value: "bom dia", weight: 0.9 },
      { type: "keyword", value: "boa tarde", weight: 0.9 },
      { type: "keyword", value: "boa noite", weight: 0.9 }
    ],
    examples: [
      {
        user: "Oi, tudo bem?",
        assistant: "Olá! Tudo ótimo, e com você? 😊 Como posso ajudar hoje?"
      },
      {
        user: "Bom dia!",
        assistant: "Bom dia! 😊 Tudo bem? Estou aqui para te ajudar com o que precisar."
      }
    ],
    functions: [],
    priority: 8,
    enabled: true
  },
  {
    name: "farewell",
    category: "communication",
    description: "Despede-se de forma cordial e oferece retorno",
    triggers: [
      { type: "intent", value: "farewell", weight: 1 },
      { type: "keyword", value: "tchau", weight: 0.8 },
      { type: "keyword", value: "até mais", weight: 0.8 },
      { type: "keyword", value: "obrigado", weight: 0.6 },
      { type: "keyword", value: "valeu", weight: 0.6 }
    ],
    examples: [
      {
        user: "Obrigado, tchau!",
        assistant: "Por nada! Se precisar de algo, é só chamar. Até logo! 👋"
      }
    ],
    functions: [],
    priority: 7,
    enabled: true
  },

  // ========== SALES ==========
  {
    name: "send_catalog",
    category: "sales",
    description: "Lista e envia catálogos de produtos. SEMPRE liste primeiro antes de enviar.",
    triggers: [
      { type: "intent", value: "request_catalog", weight: 1 },
      { type: "keyword", value: "catálogo", weight: 0.9 },
      { type: "keyword", value: "catalogo", weight: 0.9 },
      { type: "keyword", value: "quais produtos", weight: 0.7 },
      { type: "keyword", value: "ver produtos", weight: 0.7 }
    ],
    examples: [
      {
        user: "Quero ver o catálogo",
        assistant: "Claro! Temos alguns catálogos disponíveis. Vou listar para você escolher.",
        function: "listar_catalogos"
      },
      {
        user: "Me manda o catálogo completo",
        assistant: "Perfeito! Vou te enviar o catálogo completo agora.",
        function: "enviar_catalogo"
      }
    ],
    functions: ["listar_catalogos", "enviar_catalogo"],
    conditions: [
      { field: "contact.cnpj", operator: "exists" },
      { field: "contact.email", operator: "exists" }
    ],
    priority: 9,
    enabled: true
  },
  {
    name: "send_price_table",
    category: "sales",
    description: "Lista e envia tabelas de preços. REQUER cadastro completo (CNPJ + email).",
    triggers: [
      { type: "intent", value: "request_price", weight: 1 },
      { type: "keyword", value: "tabela de preço", weight: 0.9 },
      { type: "keyword", value: "tabela de preços", weight: 0.9 },
      { type: "keyword", value: "preço", weight: 0.7 },
      { type: "keyword", value: "valores", weight: 0.7 },
      { type: "keyword", value: "quanto custa", weight: 0.8 }
    ],
    examples: [
      {
        user: "Quero a tabela de preços",
        assistant: "Vou verificar as tabelas disponíveis para você.",
        function: "listar_tabelas_precos"
      },
      {
        user: "Manda a tabela premium",
        assistant: "Perfeito! Enviando a tabela premium.",
        function: "enviar_tabela_precos"
      }
    ],
    functions: ["listar_tabelas_precos", "enviar_tabela_precos"],
    conditions: [
      { field: "contact.cnpj", operator: "exists" },
      { field: "contact.email", operator: "exists" }
    ],
    priority: 9,
    enabled: true
  },
  {
    name: "send_info",
    category: "sales",
    description: "Lista e envia informativos (políticas, negociações, CST, etc).",
    triggers: [
      { type: "intent", value: "request_info", weight: 1 },
      { type: "keyword", value: "informativo", weight: 0.9 },
      { type: "keyword", value: "política", weight: 0.7 },
      { type: "keyword", value: "frete", weight: 0.6 },
      { type: "keyword", value: "CST", weight: 0.7 },
      { type: "keyword", value: "CIF", weight: 0.7 },
      { type: "keyword", value: "FOB", weight: 0.7 }
    ],
    examples: [
      {
        user: "Qual a política de frete?",
        assistant: "Temos informativos sobre frete. Vou listar as opções.",
        function: "listar_informativos"
      }
    ],
    functions: ["listar_informativos", "enviar_informativo"],
    priority: 8,
    enabled: true
  },

  // ========== CRM ==========
  {
    name: "update_contact",
    category: "crm",
    description: "Atualiza dados cadastrais do cliente (CNPJ, email, razão social, etc).",
    triggers: [
      { type: "entity", value: "cnpj", weight: 0.9 },
      { type: "entity", value: "email", weight: 0.9 },
      { type: "entity", value: "razao_social", weight: 0.8 },
      { type: "keyword", value: "meu cnpj é", weight: 0.9 },
      { type: "keyword", value: "meu email é", weight: 0.9 }
    ],
    examples: [
      {
        user: "Meu CNPJ é 12.345.678/0001-90",
        assistant: "Perfeito! Vou atualizar seu cadastro com esse CNPJ.",
        function: "atualizar_contato"
      },
      {
        user: "O email da empresa é contato@empresa.com",
        assistant: "Obrigado! Vou salvar esse email no seu cadastro.",
        function: "atualizar_contato"
      }
    ],
    functions: ["atualizar_contato"],
    priority: 10,
    enabled: true
  },
  {
    name: "check_registration",
    category: "crm",
    description: "Verifica se o cliente tem cadastro completo antes de enviar materiais restritos.",
    triggers: [
      { type: "condition", value: "before_send_price_table", weight: 1 }
    ],
    examples: [
      {
        user: "Quero a tabela de preços",
        assistant: "Vou verificar seu cadastro rapidinho.",
        function: "verificar_cadastro_completo"
      }
    ],
    functions: ["verificar_cadastro_completo"],
    priority: 10,
    enabled: true
  },

  // ========== ROUTING ==========
  {
    name: "transfer_to_attendant",
    category: "routing",
    description: "Transfere para atendente humano disponível. Use quando: problema complexo, reclamação, cliente pedir humano.",
    triggers: [
      { type: "intent", value: "request_human", weight: 1 },
      { type: "keyword", value: "falar com atendente", weight: 0.9 },
      { type: "keyword", value: "falar com humano", weight: 0.9 },
      { type: "keyword", value: "quero falar com alguém", weight: 0.8 },
      { type: "keyword", value: "reclamação", weight: 0.7 },
      { type: "keyword", value: "reclamar", weight: 0.7 }
    ],
    examples: [
      {
        user: "Quero falar com um atendente",
        assistant: "Claro! Vou te transferir para um atendente agora.",
        function: "transferir_para_atendente"
      },
      {
        user: "Isso é uma reclamação!",
        assistant: "Entendo. Vou transferir você para um atendente que pode resolver isso.",
        function: "transferir_para_atendente"
      }
    ],
    functions: ["transferir_para_atendente"],
    priority: 9,
    enabled: true
  },
  {
    name: "transfer_to_seller",
    category: "routing",
    description: "Transfere para o vendedor RESPONSÁVEL pelo cliente (baseado em tags pessoais).",
    triggers: [
      { type: "intent", value: "request_specific_seller", weight: 1 },
      { type: "keyword", value: "falar com o vendedor", weight: 0.8 },
      { type: "keyword", value: "falar com meu vendedor", weight: 0.9 },
      { type: "keyword", value: "falar com a Bruna", weight: 0.9 },
      { type: "keyword", value: "falar com o Felipe", weight: 0.9 }
    ],
    examples: [
      {
        user: "Quero falar com meu vendedor",
        assistant: "Vou verificar quem é o vendedor responsável pelo seu cadastro e transferir.",
        function: "transferir_para_vendedor_responsavel"
      }
    ],
    functions: ["transferir_para_vendedor_responsavel"],
    priority: 9,
    enabled: true
  },

  // ========== RAG ==========
  {
    name: "search_knowledge",
    category: "rag",
    description: "Busca informações na base de conhecimento (RAG) para responder perguntas específicas.",
    triggers: [
      { type: "intent", value: "question", weight: 0.8 },
      { type: "keyword", value: "como funciona", weight: 0.7 },
      { type: "keyword", value: "qual é", weight: 0.6 },
      { type: "keyword", value: "informação sobre", weight: 0.7 }
    ],
    examples: [
      {
        user: "Como funciona o produto X?",
        assistant: "Vou buscar informações sobre esse produto.",
        function: "buscar_produto_detalhado"
      },
      {
        user: "Me manda o manual do produto Y",
        assistant: "Vou buscar o manual e te enviar.",
        function: "buscar_e_enviar_arquivo"
      }
    ],
    functions: ["buscar_produto_detalhado", "buscar_e_enviar_arquivo", "listar_arquivos_disponiveis"],
    priority: 7,
    enabled: true
  },

  // ========== SDR ==========
  {
    name: "qualify_lead",
    category: "sdr",
    description: "Qualifica lead usando metodologia BANT/SPIN/GPCT. Registra respostas e calcula score.",
    triggers: [
      { type: "condition", value: "sdr_enabled", weight: 1 },
      { type: "keyword", value: "orçamento", weight: 0.8 },
      { type: "keyword", value: "comprar", weight: 0.7 },
      { type: "keyword", value: "quanto custa", weight: 0.8 }
    ],
    examples: [
      {
        user: "Quero fazer um pedido grande",
        assistant: "Ótimo! Para te ajudar melhor, qual o volume de compras mensal da sua empresa?",
        function: "registrar_resposta_qualificacao"
      }
    ],
    functions: [
      "calcular_score_lead",
      "registrar_resposta_qualificacao",
      "enviar_link_agendamento",
      "transferir_para_closer"
    ],
    conditions: [
      { field: "agent.sdrEnabled", operator: "equals", value: true }
    ],
    priority: 8,
    enabled: true
  },

  // ========== SCHEDULING ==========
  {
    name: "schedule_meeting",
    category: "scheduling",
    description: "Agenda reunião com especialista via link de calendário (Calendly, etc).",
    triggers: [
      { type: "intent", value: "schedule", weight: 1 },
      { type: "keyword", value: "agendar", weight: 0.9 },
      { type: "keyword", value: "reunião", weight: 0.8 },
      { type: "keyword", value: "marcar horário", weight: 0.8 }
    ],
    examples: [
      {
        user: "Quero agendar uma reunião",
        assistant: "Que tal agendarmos uma conversa com nosso especialista?",
        function: "enviar_link_agendamento"
      }
    ],
    functions: ["enviar_link_agendamento"],
    conditions: [
      { field: "agent.sdrSchedulingEnabled", operator: "equals", value: true }
    ],
    priority: 8,
    enabled: true
  }
];

/**
 * Gera prompt de skills para o agente
 */
export const generateSkillsPrompt = (skills: AISkill[]): string => {
  const enabledSkills = skills.filter(s => s.enabled);
  
  const sections = enabledSkills.map(skill => {
    const triggers = skill.triggers
      .filter(t => t.type === "keyword" || t.type === "intent")
      .map(t => t.value)
      .slice(0, 5);
    
    const examples = skill.examples
      .map(e => `  Cliente: "${e.user}"\n  Você: "${e.assistant}"${e.function ? ` [${e.function}]` : ""}`)
      .join("\n");
    
    const functions = skill.functions.length > 0
      ? `\n  Funções disponíveis: ${skill.functions.join(", ")}`
      : "";
    
    const conditions = skill.conditions && skill.conditions.length > 0
      ? `\n  Condições: ${skill.conditions.map(c => `${c.field} ${c.operator}`).join(", ")}`
      : "";

    return `### ${skill.name.toUpperCase()}
${skill.description}
  Gatilhos: ${triggers.join(", ")}${functions}${conditions}
  Exemplos:
${examples}`;
  });

  return `# SKILLS DISPONÍVEIS

Você possui as seguintes capacidades (skills). Use a skill apropriada baseada no contexto:

${sections.join("\n\n")}

## REGRAS IMPORTANTES:
1. SEMPRE use a skill com maior prioridade quando múltiplas aplicam
2. SEMPRE liste opções antes de enviar (ex: listar_catalogos antes de enviar_catalogo)
3. VERIFIQUE condições antes de usar skills restritivas (ex: cadastro para tabela de preços)
4. USE as funções disponíveis - não simule ações, execute-as
`;
};

/**
 * Filtra skills por categoria
 */
export const getSkillsByCategory = (skills: AISkill[], category: SkillCategory): AISkill[] => {
  return skills.filter(s => s.category === category && s.enabled);
};

/**
 * Encontra skills aplicáveis baseado em texto
 */
export const findApplicableSkills = (
  skills: AISkill[],
  text: string,
  context?: Record<string, any>
): AISkill[] => {
  const textLower = text.toLowerCase();
  
  const scored = skills
    .filter(s => s.enabled)
    .map(skill => {
      let score = 0;
      
      // Score por gatilhos
      for (const trigger of skill.triggers) {
        if (trigger.type === "keyword" && textLower.includes(trigger.value.toLowerCase())) {
          score += (trigger.weight || 0.5) * 10;
        }
        if (trigger.type === "intent" && textLower.includes(trigger.value.toLowerCase())) {
          score += (trigger.weight || 0.5) * 15;
        }
      }
      
      // Score por condições
      if (skill.conditions && context) {
        let conditionsMet = 0;
        for (const cond of skill.conditions) {
          const fieldValue = getNestedValue(context, cond.field);
          if (checkCondition(fieldValue, cond)) {
            conditionsMet++;
          }
        }
        if (conditionsMet === skill.conditions.length) {
          score += 5;
        }
      }
      
      // Score por prioridade
      score += skill.priority;
      
      return { skill, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(s => s.skill);
};

/**
 * Helper para obter valor aninhado
 */
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

/**
 * Helper para verificar condição
 */
const checkCondition = (value: any, condition: SkillCondition): boolean => {
  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null && value !== "";
    case "not_exists":
      return value === undefined || value === null || value === "";
    case "equals":
      return value === condition.value;
    case "contains":
      return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
    case "gt":
      return Number(value) > Number(condition.value);
    case "lt":
      return Number(value) < Number(condition.value);
    default:
      return false;
  }
};

/**
 * Valida skill
 */
export const validateSkill = (skill: AISkill): string[] => {
  const errors: string[] = [];
  
  if (!skill.name || skill.name.trim() === "") {
    errors.push("Nome é obrigatório");
  }
  
  if (!skill.description || skill.description.trim() === "") {
    errors.push("Descrição é obrigatória");
  }
  
  if (skill.triggers.length === 0) {
    errors.push("Pelo menos um gatilho é obrigatório");
  }
  
  if (skill.priority < 1 || skill.priority > 10) {
    errors.push("Prioridade deve ser entre 1 e 10");
  }
  
  return errors;
};

export default {
  DEFAULT_SKILLS,
  generateSkillsPrompt,
  getSkillsByCategory,
  findApplicableSkills,
  validateSkill
};
