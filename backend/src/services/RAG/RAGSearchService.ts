import sequelize from "../../database";
import { embedTexts } from "./EmbeddingService";
import { rerankResults, rerankByDiversity } from "./RAGReranker";
import { logSearch } from "./RAGMetrics";

export interface SearchParams {
  companyId: number;
  query: string;
  k?: number;
  tags?: string[];
  tagsMode?: "AND" | "OR"; // Modo de filtro de tags: AND (todas) ou OR (qualquer uma)
  documentId?: number;
  hybrid?: boolean; // Ativar busca híbrida (keyword + semantic)
  rerank?: boolean; // Ativar reranking com LLM
  useCache?: boolean; // Usar cache de embeddings
}

export interface SearchResultItem {
  chunkId: number;
  documentId: number;
  title: string;
  content: string;
  distance: number; // cosine distance (menor é melhor)
  score?: number; // score após reranking
  source?: string; // caminho do arquivo original
  mimeType?: string; // tipo do arquivo
  libraryFileId?: number; // ID do LibraryFile vinculado (se houver)
  fileOptionId?: number; // ID do FilesOptions vinculado (se houver)
}

/**
 * Busca híbrida: combina semantic search (embeddings) com keyword search (FTS)
 * Melhora precisão para queries específicas e termos técnicos
 */
export const searchHybrid = async (params: SearchParams): Promise<SearchResultItem[]> => {
  const { companyId, query, k = 5, tags = [], tagsMode = "AND", documentId, hybrid = true, rerank = true } = params;
  
  if (!query || !query.trim()) return [];

  const startTime = Date.now();
  
  // Gera embedding da query
  const [qvec] = await embedTexts(companyId, [query]);
  const qvecStr = `[${qvec.join(",")}]`;

  const whereParts: string[] = ['c."companyId" = :companyId'];
  const replacements: any = { companyId, qvec: qvecStr, query: query.trim(), k };

  if (documentId) {
    whereParts.push('c."documentId" = :documentId');
    replacements.documentId = documentId;
  }

  if (Array.isArray(tags) && tags.length) {
    if (tagsMode === "OR") {
      const tagConditions = tags.map((t, idx) => {
        replacements[`tag_${idx}`] = `%"${t}"%`;
        return `c."tags" ILIKE :tag_${idx}`;
      });
      whereParts.push(`(${tagConditions.join(' OR ')})`);
    } else {
      tags.forEach((t, idx) => {
        whereParts.push(`c."tags" ILIKE :tag_${idx}`);
        replacements[`tag_${idx}`] = `%"${t}"%`;
      });
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  let rows: any[];

  if (hybrid) {
    // BUSCA HÍBRIDA: combina semantic + keyword
    // Usa RRF (Reciprocal Rank Fusion) para combinar scores
    const fetchLimit = k * 3; // Busca mais para rerank

    const [semanticRows] = await sequelize.query(
      `SELECT c."id" as "chunkId", c."documentId", d."title", c."content",
              d."source", d."mimeType",
              lf."id" as "libraryFileId", lf."fileOptionId",
              (c."embedding" <=> :qvec::vector) as distance,
              1 as semantic_rank
         FROM "KnowledgeChunks" c
         JOIN "KnowledgeDocuments" d ON d."id" = c."documentId"
         LEFT JOIN "LibraryFiles" lf ON lf."knowledgeDocumentId" = d."id"
        ${whereSql}
     ORDER BY distance ASC
        LIMIT :fetchLimit`,
      { replacements: { ...replacements, fetchLimit } }
    );

    // Busca keyword (Full Text Search)
    const [keywordRows] = await sequelize.query(
      `SELECT c."id" as "chunkId", c."documentId", d."title", c."content",
              d."source", d."mimeType",
              lf."id" as "libraryFileId", lf."fileOptionId",
              0.99 as distance,
              ts_rank_cd(to_tsvector('portuguese', c.content), plainto_tsquery('portuguese', :query)) as kw_score
         FROM "KnowledgeChunks" c
         JOIN "KnowledgeDocuments" d ON d."id" = c."documentId"
         LEFT JOIN "LibraryFiles" lf ON lf."knowledgeDocumentId" = d."id"
        ${whereSql}
          AND to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', :query)
     ORDER BY kw_score DESC
        LIMIT :fetchLimit`,
      { replacements: { ...replacements, fetchLimit } }
    );

    // Combina resultados com RRF
    const combined = combineWithRRF(semanticRows as any[], keywordRows as any[], fetchLimit);
    rows = combined;

  } else {
    // BUSCA SEMÂNTICA PURA (comportamento original)
    [rows] = await sequelize.query(
      `SELECT c."id" as "chunkId", c."documentId", d."title", c."content",
              d."source", d."mimeType",
              lf."id" as "libraryFileId", lf."fileOptionId",
              (c."embedding" <=> :qvec::vector) as distance
         FROM "KnowledgeChunks" c
         JOIN "KnowledgeDocuments" d ON d."id" = c."documentId"
         LEFT JOIN "LibraryFiles" lf ON lf."knowledgeDocumentId" = d."id"
        ${whereSql}
     ORDER BY distance ASC
        LIMIT :k`,
      { replacements }
    );
  }

  let results: SearchResultItem[] = (rows as any[]).map(r => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    title: r.title,
    content: r.content,
    distance: Number(r.distance),
    source: r.source || undefined,
    mimeType: r.mimeType || undefined,
    libraryFileId: r.libraryFileId || undefined,
    fileOptionId: r.fileOptionId || undefined
  }));

  // Reranking com LLM (se ativado)
  if (rerank && results.length > 0) {
    try {
      const reranked = await rerankResults(companyId, query, results, { topN: k });
      results = reranked;
    } catch (error) {
      // Fallback: diversidade
      results = rerankByDiversity(results, k);
    }
  }

  // Log de métricas
  const latency = Date.now() - startTime;
  console.log(`[RAG] Search completed: ${results.length} results, ${latency}ms, hybrid=${hybrid}, rerank=${rerank}`);

  // Registra para métricas
  logSearch({
    companyId,
    query: query.slice(0, 100), // Limita tamanho
    k,
    hits: results.length,
    latencyMs: latency,
    hybrid,
    rerank,
    topDistance: results[0]?.distance || 0
  });

  return results.slice(0, k);
};

/**
 * Combina resultados semânticos e keyword usando Reciprocal Rank Fusion (RRF)
 * RRF score = sum(1 / (k + rank)) para cada lista
 */
const combineWithRRF = (
  semantic: any[],
  keyword: any[],
  limit: number
): any[] => {
  const k = 60; // Constante RRF
  const scores = new Map<number, { item: any; score: number }>();

  // Processa resultados semânticos
  semantic.forEach((item, rank) => {
    const id = item.chunkId;
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(id, { item, score: rrfScore });
    }
  });

  // Processa resultados keyword
  keyword.forEach((item, rank) => {
    const id = item.chunkId;
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(id, { item, score: rrfScore });
    }
  });

  // Ordena por score combinado
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      ...s.item,
      distance: 1 - s.score // Normaliza para distance
    }));
};

/**
 * Busca semântica pura (mantém compatibilidade)
 */
export const search = searchHybrid;

export default { search, searchHybrid };
