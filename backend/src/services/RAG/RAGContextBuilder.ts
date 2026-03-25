import { SearchResultItem } from "./RAGSearchService";
import OpenAI from "openai";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";

/**
 * Serviço para construir contexto RAG otimizado
 * - Remove duplicatas
 * - Agrupa por documento
 * - Resume se muito longo
 * - Formata coerentemente
 */

export interface ContextOptions {
  maxTotalChars?: number; // Máximo de caracteres no contexto (default: 3000)
  maxChunks?: number; // Máximo de chunks (default: 10)
  similarityThreshold?: number; // Threshold para duplicatas (default: 0.85)
  summarizeIfOversized?: boolean; // Resumir com LLM se grande (default: true)
  includeMetadata?: boolean; // Incluir metadados (default: true)
}

export interface ContextResult {
  context: string;
  stats: {
    inputChunks: number;
    outputChunks: number;
    duplicatesRemoved: number;
    totalChars: number;
    wasSummarized: boolean;
  };
}

/**
 * Constrói contexto otimizado para injeção no prompt
 */
export const buildContext = async (
  companyId: number,
  hits: SearchResultItem[],
  options: ContextOptions = {}
): Promise<ContextResult> => {
  const {
    maxTotalChars = 3000,
    maxChunks = 10,
    similarityThreshold = 0.85,
    summarizeIfOversized = true,
    includeMetadata = true
  } = options;

  const stats = {
    inputChunks: hits.length,
    outputChunks: 0,
    duplicatesRemoved: 0,
    totalChars: 0,
    wasSummarized: false
  };

  if (!hits.length) {
    return { context: "", stats };
  }

  // 1. Remove duplicatas por similaridade
  const unique = removeDuplicates(hits, similarityThreshold);
  stats.duplicatesRemoved = hits.length - unique.length;

  // 2. Limita número de chunks
  const limited = unique.slice(0, maxChunks);

  // 3. Agrupa por documento para coerência
  const grouped = groupByDocument(limited);

  // 4. Formata contexto
  let context = formatContext(grouped, includeMetadata);

  // 5. Verifica tamanho e resume se necessário
  if (context.length > maxTotalChars && summarizeIfOversized) {
    try {
      context = await summarizeContext(companyId, context, maxTotalChars);
      stats.wasSummarized = true;
    } catch (error) {
      // Fallback: trunca
      context = context.slice(0, maxTotalChars) + "\n[...truncado...]";
    }
  }

  stats.outputChunks = limited.length;
  stats.totalChars = context.length;

  return { context, stats };
};

/**
 * Remove chunks duplicados por similaridade de conteúdo
 */
const removeDuplicates = (
  hits: SearchResultItem[],
  threshold: number
): SearchResultItem[] => {
  const unique: SearchResultItem[] = [];

  for (const hit of hits) {
    const isDuplicate = unique.some(existing => {
      // Mesmo documento e conteúdo muito similar
      if (existing.documentId === hit.documentId) {
        const similarity = calculateJaccardSimilarity(existing.content, hit.content);
        return similarity > threshold;
      }
      // Conteúdo muito similar entre documentos diferentes
      const similarity = calculateJaccardSimilarity(existing.content, hit.content);
      return similarity > 0.95; // Threshold mais alto para docs diferentes
    });

    if (!isDuplicate) {
      unique.push(hit);
    }
  }

  return unique;
};

/**
 * Calcula similaridade Jaccard entre dois textos
 */
const calculateJaccardSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
};

/**
 * Agrupa chunks por documento para melhor coerência
 */
interface GroupedChunk {
  documentId: number;
  title: string;
  source?: string;
  chunks: Array<{ content: string; distance: number }>;
}

const groupByDocument = (hits: SearchResultItem[]): GroupedChunk[] => {
  const groups = new Map<number, GroupedChunk>();

  for (const hit of hits) {
    const existing = groups.get(hit.documentId);
    if (existing) {
      existing.chunks.push({ content: hit.content, distance: hit.distance });
    } else {
      groups.set(hit.documentId, {
        documentId: hit.documentId,
        title: hit.title,
        source: hit.source,
        chunks: [{ content: hit.content, distance: hit.distance }]
      });
    }
  }

  // Ordena chunks dentro de cada grupo por distância
  for (const group of groups.values()) {
    group.chunks.sort((a, b) => a.distance - b.distance);
  }

  return Array.from(groups.values());
};

/**
 * Formata contexto de forma coerente
 */
const formatContext = (
  groups: GroupedChunk[],
  includeMetadata: boolean
): string => {
  const parts: string[] = [];

  for (const group of groups) {
    const header = includeMetadata
      ? `📄 **${group.title}**${group.source ? ` (${group.source})` : ''}`
      : `📄 **${group.title}**`;

    const content = group.chunks
      .map(c => c.content)
      .join("\n\n");

    parts.push(`${header}\n${content}`);
  }

  return parts.join("\n\n---\n\n");
};

/**
 * Resume contexto usando LLM se muito grande
 */
const summarizeContext = async (
  companyId: number,
  context: string,
  targetLength: number
): Promise<string> => {
  try {
    const resolved = await ResolveAIIntegrationService({
      companyId,
      preferProvider: "openai" as any
    });

    if (!resolved?.config?.apiKey) {
      return context.slice(0, targetLength);
    }

    const client = new OpenAI({ apiKey: resolved.config.apiKey });

    const prompt = `Você é um assistente especializado em condensar informações.

O seguinte contexto foi recuperado de uma base de conhecimento para responder uma pergunta. 
Condense-o mantendo as informações mais importantes e relevantes.

CONTEXTO ORIGINAL (${context.length} caracteres):
"""
${context}
"""

INSTRUÇÕES:
1. Mantenha fatos, números, nomes e informações específicas
2. Remova redundâncias e repetições
3. Preserve a estrutura por documento
4. Resultado deve ter no máximo ${Math.floor(targetLength * 0.8)} caracteres
5. Use linguagem clara e direta

CONTEXTO CONDENSADO:`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: Math.floor(targetLength / 4) // ~4 chars por token
    });

    const summarized = response.choices[0]?.message?.content || context.slice(0, targetLength);

    console.log(`[RAGContext] Contexto resumido: ${context.length} → ${summarized.length} chars`);

    return summarized;
  } catch (error: any) {
    console.error("[RAGContext] Erro ao resumir:", error.message);
    return context.slice(0, targetLength);
  }
};

/**
 * Formata contexto para injeção no prompt do chat
 */
export const formatContextForPrompt = (
  context: string,
  query?: string
): string => {
  if (!context) return "";

  const header = query
    ? `Informações relevantes encontradas para: "${query}"`
    : "Informações relevantes da base de conhecimento:";

  return `${header}

${context}

---
Use as informações acima APENAS se forem relevantes para a pergunta. Não invente fatos.`;
};

export default { buildContext, formatContextForPrompt };
