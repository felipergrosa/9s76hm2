import OpenAI from "openai";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import { SearchResultItem } from "./RAGSearchService";

/**
 * Reranker usando LLM para melhorar ordenação dos resultados
 * Usa cross-encoder simulado via GPT-4o-mini
 */

export interface RerankOptions {
  topN?: number; // Quantos resultados retornar após rerank
  maxContentLength?: number; // Tamanho máximo de cada conteúdo para prompt
}

/**
 * Reranka resultados usando LLM como cross-encoder
 * Mais preciso que apenas similaridade vetorial
 */
export const rerankResults = async (
  companyId: number,
  query: string,
  results: SearchResultItem[],
  options: RerankOptions = {}
): Promise<SearchResultItem[]> => {
  const { topN = 5, maxContentLength = 300 } = options;

  if (!results.length || results.length <= 1) {
    return results.slice(0, topN);
  }

  // Se poucos resultados, não precisa rerank
  if (results.length <= topN) {
    return results;
  }

  try {
    // Resolve API key
    const resolved = await ResolveAIIntegrationService({ 
      companyId, 
      preferProvider: "openai" as any 
    });

    if (!resolved?.config?.apiKey) {
      console.warn("[RAGReranker] Sem API key, retornando ordem original");
      return results.slice(0, topN);
    }

    const client = new OpenAI({ apiKey: resolved.config.apiKey });

    // Prepara conteúdos truncados
    const contents = results.map((r, i) => {
      const content = r.content.length > maxContentLength 
        ? r.content.slice(0, maxContentLength) + "..."
        : r.content;
      return `[${i}] ${content}`;
    }).join("\n\n");

    const prompt = `Você é um especialista em recuperação de informação. Dado uma pergunta e vários trechos de documentos, sua tarefa é avaliar a relevância de cada trecho para a pergunta.

PERGUNTA: "${query}"

TRECHOS:
${contents}

INSTRUÇÕES:
1. Avalie cada trecho de 0 a 10 (0 = irrelevante, 10 = altamente relevante)
2. Considere: resposta direta, informação relacionada, contexto útil
3. Retorne APENAS um JSON com os índices ordenados por relevância (mais relevante primeiro)

EXEMPLO DE RESPOSTA:
{"ranked": [2, 0, 3, 1], "scores": {"0": 8, "1": 5, "2": 9, "3": 7}}

Sua resposta:`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[RAGReranker] Resposta vazia do LLM");
      return results.slice(0, topN);
    }

    const parsed = JSON.parse(content);
    const ranked: number[] = parsed.ranked || [];

    if (!Array.isArray(ranked) || ranked.length === 0) {
      console.warn("[RAGReranker] Formato inválido, usando ordem original");
      return results.slice(0, topN);
    }

    // Reordena resultados baseado no ranking
    const reranked = ranked
      .filter(idx => idx >= 0 && idx < results.length)
      .slice(0, topN)
      .map(idx => ({
        ...results[idx],
        score: parsed.scores?.[idx] || (10 - results[idx].distance * 10)
      }));

    console.log(`[RAGReranker] Reranked ${reranked.length} results for query: "${query.slice(0, 50)}..."`);

    return reranked;

  } catch (error: any) {
    console.error("[RAGReranker] Erro no reranking:", error.message);
    // Fallback: retorna top N por distance original
    return results.slice(0, topN);
  }
};

/**
 * Reranking simples por diversidade (evita duplicatas)
 * Útil quando não temos LLM disponível
 */
export const rerankByDiversity = (
  results: SearchResultItem[],
  topN: number = 5,
  similarityThreshold: number = 0.9
): SearchResultItem[] => {
  const selected: SearchResultItem[] = [];
  
  for (const result of results) {
    // Verifica se é muito similar aos já selecionados
    const isDuplicate = selected.some(s => {
      // Simples: verifica se mesmo documento e conteúdo similar
      if (s.documentId === result.documentId) {
        const overlap = calculateOverlap(s.content, result.content);
        return overlap > similarityThreshold;
      }
      return false;
    });

    if (!isDuplicate) {
      selected.push(result);
      if (selected.length >= topN) break;
    }
  }

  return selected;
};

/**
 * Calcula overlap entre dois textos (Jaccard similarity)
 */
const calculateOverlap = (text1: string, text2: string): number => {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

export default { rerankResults, rerankByDiversity };
