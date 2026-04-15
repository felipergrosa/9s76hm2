/**
 * AIOutputGuardrailService.ts
 * 
 * Sistema de guardrails para saída da IA:
 * - Detecção de PII (dados pessoais)
 * - Palavras bloqueadas
 * - Factual grounding (verificação contra RAG)
 * - Toxicidade
 * - Validação de claims factuais
 */

import logger from "../../utils/logger";

// PII Patterns brasileiros
const PII_PATTERNS = {
  cpf: /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g,
  cnpj: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g,
  cep: /\b\d{5}[-\s]?\d{3}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  rg: /\b\d{1,2}[.\s]?\d{3}[.\s]?\d{3}[-\s]?[\dX]\b/g
};

// Palavras bloqueadas (exemplo)
const BLOCKED_KEYWORDS = [
  "senha", "password", "token", "api_key", "secret",
  "cartão de crédito", "número do cartão", "cvv", "cvc"
];

// Padrões de prompt injection
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /disregard .* rules/i,
  /pretend you are/i,
  /act as if you are/i,
  /jailbreak/i,
  /DAN/i,
  /\/system/i,
  /\/prompt/i
];

interface GuardrailCheck {
  passed: boolean;
  severity: "low" | "medium" | "high" | "critical";
  violations: string[];
  sanitized?: string;
}

interface GuardrailConfig {
  checkPII: boolean;
  checkToxicity: boolean;
  checkInjection: boolean;
  checkBlockedWords: boolean;
  blockedWords: string[];
  allowPII: string[]; // Tipos de PII permitidos (ex: email para contato)
  maxPII: number; // Máximo de instâncias de PII permitidas
}

class AIOutputGuardrailService {
  private config: GuardrailConfig = {
    checkPII: true,
    checkToxicity: true,
    checkInjection: true,
    checkBlockedWords: true,
    blockedWords: BLOCKED_KEYWORDS,
    allowPII: [], // Por padrão, nenhum PII é permitido
    maxPII: 0
  };

  /**
   * Configurar guardrails
   */
  configure(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Verificar saída da IA
   */
  async checkOutput(
    output: string,
    context?: {
      companyId?: number;
      agentId?: number;
      ticketId?: number;
      expectedFacts?: string[];
    }
  ): Promise<GuardrailCheck> {
    const violations: string[] = [];
    let severity: GuardrailCheck["severity"] = "low";
    let sanitized = output;

    // Verificar PII
    if (this.config.checkPII) {
      const piiCheck = this.checkPII(output);
      if (piiCheck.found) {
        const allowedInstances = this.filterAllowedPII(piiCheck.instances);
        if (allowedInstances.length > this.config.maxPII) {
          violations.push(`PII detectado: ${allowedInstances.join(", ")}`);
          severity = this.increaseSeverity(severity, "high");
          sanitized = this.sanitizePII(sanitized, piiCheck.instances);
        }
      }
    }

    // Verificar palavras bloqueadas
    if (this.config.checkBlockedWords) {
      const blockedCheck = this.checkBlockedWords(output);
      if (blockedCheck.found) {
        violations.push(`Palavras bloqueadas: ${blockedCheck.words.join(", ")}`);
        severity = this.increaseSeverity(severity, "high");
      }
    }

    // Verificar prompt injection
    if (this.config.checkInjection) {
      const injectionCheck = this.checkInjection(output);
      if (injectionCheck.found) {
        violations.push("Possível prompt injection detectado");
        severity = "critical";
      }
    }

    // Verificar toxicidade (simples)
    if (this.config.checkToxicity) {
      const toxicityCheck = this.checkToxicity(output);
      if (toxicityCheck.isToxic) {
        violations.push("Conteúdo potencialmente tóxico detectado");
        severity = this.increaseSeverity(severity, "medium");
      }
    }

    // Log do resultado
    if (violations.length > 0) {
      logger.warn(`[Guardrail] Violações detectadas: ${violations.join("; ")}`, {
        context,
        severity,
        violations
      });
    }

    return {
      passed: violations.length === 0,
      severity,
      violations,
      sanitized: violations.length > 0 ? sanitized : undefined
    };
  }

  /**
   * Verificar PII
   */
  private checkPII(text: string): { found: boolean; instances: string[] } {
    const instances: string[] = [];

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          instances.push(`${type}: ${match.substring(0, 10)}...`);
        });
      }
    }

    return { found: instances.length > 0, instances };
  }

  /**
   * Filtrar PII permitido
   */
  private filterAllowedPII(instances: string[]): string[] {
    return instances.filter(instance => {
      const type = instance.split(":")[0];
      return !this.config.allowPII.includes(type);
    });
  }

  /**
   * Sanitizar PII
   */
  private sanitizePII(text: string, instances: string[]): string {
    let sanitized = text;
    
    for (const instance of instances) {
      const [type] = instance.split(":");
      const pattern = PII_PATTERNS[type as keyof typeof PII_PATTERNS];
      if (pattern) {
        sanitized = sanitized.replace(pattern, `[${type.toUpperCase()} REMOVIDO]`);
      }
    }

    return sanitized;
  }

  /**
   * Verificar palavras bloqueadas
   */
  private checkBlockedWords(text: string): { found: boolean; words: string[] } {
    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const word of this.config.blockedWords) {
      if (lowerText.includes(word.toLowerCase())) {
        found.push(word);
      }
    }

    return { found: found.length > 0, words: found };
  }

  /**
   * Verificar prompt injection
   */
  private checkInjection(text: string): { found: boolean } {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return { found: true };
      }
    }
    return { found: false };
  }

  /**
   * Verificar toxicidade (simplificado)
   */
  private checkToxicity(text: string): { isToxic: boolean; score: number } {
    // Palavras tóxicas brasileiras
    const toxicWords = [
      "idiota", "burro", "estúpido", "lixo", "nojento",
      "odeio", "morra", "mata", "crime", "ilegal"
    ];

    let score = 0;
    const lowerText = text.toLowerCase();

    for (const word of toxicWords) {
      if (lowerText.includes(word)) {
        score += 0.2;
      }
    }

    return { isToxic: score > 0.3, score };
  }

  /**
   * Factual grounding - verificar claims contra RAG
   */
  async verifyFacts(
    claims: string[],
    ragResults: { content: string; score: number }[]
  ): Promise<{ verified: boolean; unverifiedClaims: string[] }> {
    const unverified: string[] = [];

    for (const claim of claims) {
      // Verificar se claim aparece nos resultados RAG com score alto
      const found = ragResults.some(
        r => r.content.toLowerCase().includes(claim.toLowerCase()) && r.score > 0.7
      );

      if (!found) {
        unverified.push(claim);
      }
    }

    return {
      verified: unverified.length === 0,
      unverifiedClaims: unverified
    };
  }

  /**
   * Extrair claims factuais do texto
   */
  extractClaims(text: string): string[] {
    // Heurística simples: sentenças com números, datas, valores
    const claims: string[] = [];
    const sentences = text.split(/[.!?]+/);

    const claimPatterns = [
      /\d+\.\d{2}/, // Valores monetários
      /\d{2}\/\d{2}\/\d{4}/, // Datas
      /R\$\s*\d+/, // Reais
      /\d+%/, // Porcentagens
      /CNPJ\s*\d/, // CNPJ mencionado
      /CPF\s*\d/, // CPF mencionado
    ];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) continue;

      for (const pattern of claimPatterns) {
        if (pattern.test(trimmed)) {
          claims.push(trimmed);
          break;
        }
      }
    }

    return claims;
  }

  /**
   * Aumentar severidade
   */
  private increaseSeverity(
    current: GuardrailCheck["severity"],
    proposed: GuardrailCheck["severity"]
  ): GuardrailCheck["severity"] {
    const levels: GuardrailCheck["severity"][] = ["low", "medium", "high", "critical"];
    const currentIdx = levels.indexOf(current);
    const proposedIdx = levels.indexOf(proposed);
    return levels[Math.max(currentIdx, proposedIdx)];
  }

  /**
   * Log seguro (sanitizado)
   */
  safeLog(message: string, data?: any): void {
    const sanitized = data ? JSON.stringify(data).replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[CPF]") : "";
    logger.info(`[Guardrail] ${message} ${sanitized}`);
  }
}

// Singleton
export const aiOutputGuardrail = new AIOutputGuardrailService();
export default aiOutputGuardrail;
