/**
 * Métricas e Observabilidade para RAG
 * Coleta estatísticas de uso, performance e qualidade
 */

import sequelize from "../../database";
import { QueryTypes } from "sequelize";

export interface RAGMetrics {
  // Estatísticas gerais
  totalDocuments: number;
  totalChunks: number;
  totalCompanies: number;
  
  // Performance
  avgSearchLatencyMs: number;
  avgIndexingLatencyMs: number;
  
  // Uso
  searchesLast24h: number;
  searchesLast7d: number;
  indexingLast24h: number;
  
  // Qualidade
  avgResultsPerSearch: number;
  avgDistanceScore: number;
  
  // Por empresa
  topCompanies: Array<{
    companyId: number;
    documents: number;
    chunks: number;
    searches: number;
  }>;
  
  // Por tipo de documento
  documentsByType: Record<string, number>;
  
  // Cache
  cacheHitRate?: number;
  cacheSize?: number;
}

export interface SearchLog {
  companyId: number;
  query: string;
  k: number;
  hits: number;
  latencyMs: number;
  hybrid: boolean;
  rerank: boolean;
  topDistance: number;
  timestamp: Date;
}

// Armazena logs em memória (para produção, usar Redis ou tabela dedicada)
const searchLogs: SearchLog[] = [];
const MAX_LOGS = 10000;

/**
 * Registra uma busca para métricas
 */
export const logSearch = (log: Omit<SearchLog, 'timestamp'>): void => {
  searchLogs.push({
    ...log,
    timestamp: new Date()
  });

  // Limita tamanho do log
  if (searchLogs.length > MAX_LOGS) {
    searchLogs.shift();
  }
};

/**
 * Coleta métricas completas do RAG
 */
export const collectMetrics = async (): Promise<RAGMetrics> => {
  // Estatísticas gerais
  const [docStats] = await sequelize.query(`
    SELECT 
      COUNT(DISTINCT d.id) as "totalDocuments",
      COUNT(c.id) as "totalChunks",
      COUNT(DISTINCT d."companyId") as "totalCompanies"
    FROM "KnowledgeDocuments" d
    LEFT JOIN "KnowledgeChunks" c ON c."documentId" = d.id
  `, { type: QueryTypes.SELECT });

  const stats = docStats as any;

  // Documentos por tipo (mimeType)
  const [typeStats] = await sequelize.query(`
    SELECT 
      COALESCE("mimeType", 'unknown') as type,
      COUNT(*) as count
    FROM "KnowledgeDocuments"
    GROUP BY "mimeType"
    ORDER BY count DESC
    LIMIT 10
  `, { type: QueryTypes.SELECT });

  const documentsByType: Record<string, number> = {};
  for (const row of typeStats as any[]) {
    documentsByType[row.type] = Number(row.count);
  }

  // Top empresas por volume
  const [companyStats] = await sequelize.query(`
    SELECT 
      d."companyId",
      COUNT(DISTINCT d.id) as documents,
      COUNT(c.id) as chunks
    FROM "KnowledgeDocuments" d
    LEFT JOIN "KnowledgeChunks" c ON c."documentId" = d.id
    GROUP BY d."companyId"
    ORDER BY chunks DESC
    LIMIT 10
  `, { type: QueryTypes.SELECT });

  // Calcula métricas dos logs
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  const last7d = now - 7 * 24 * 60 * 60 * 1000;

  const recentLogs = searchLogs.filter(l => l.timestamp.getTime() > last24h);
  const weekLogs = searchLogs.filter(l => l.timestamp.getTime() > last7d);

  const avgSearchLatencyMs = recentLogs.length > 0
    ? Math.round(recentLogs.reduce((s, l) => s + l.latencyMs, 0) / recentLogs.length)
    : 0;

  const avgResultsPerSearch = recentLogs.length > 0
    ? Math.round(recentLogs.reduce((s, l) => s + l.hits, 0) / recentLogs.length * 10) / 10
    : 0;

  const avgDistanceScore = recentLogs.length > 0
    ? Math.round(recentLogs.reduce((s, l) => s + l.topDistance, 0) / recentLogs.length * 100) / 100
    : 0;

  // Conta buscas por empresa nos logs
  const searchesByCompany = new Map<number, number>();
  for (const log of recentLogs) {
    searchesByCompany.set(log.companyId, (searchesByCompany.get(log.companyId) || 0) + 1);
  }

  const topCompanies = (companyStats as any[]).map(row => ({
    companyId: row.companyId,
    documents: Number(row.documents),
    chunks: Number(row.chunks),
    searches: searchesByCompany.get(row.companyId) || 0
  }));

  return {
    totalDocuments: Number(stats.totalDocuments || 0),
    totalChunks: Number(stats.totalChunks || 0),
    totalCompanies: Number(stats.totalCompanies || 0),
    avgSearchLatencyMs,
    avgIndexingLatencyMs: 0, // TODO: implementar log de indexação
    searchesLast24h: recentLogs.length,
    searchesLast7d: weekLogs.length,
    indexingLast24h: 0, // TODO: implementar log de indexação
    avgResultsPerSearch,
    avgDistanceScore,
    topCompanies,
    documentsByType
  };
};

/**
 * Retorna logs recentes para análise
 */
export const getRecentLogs = (limit: number = 100): SearchLog[] => {
  return searchLogs.slice(-limit);
};

/**
 * Limpa logs antigos
 */
export const clearOldLogs = (olderThanDays: number = 7): number => {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const initialLength = searchLogs.length;
  
  const index = searchLogs.findIndex(l => l.timestamp.getTime() > cutoff);
  if (index > 0) {
    searchLogs.splice(0, index);
  }
  
  return initialLength - searchLogs.length;
};

/**
 * Estatísticas por empresa
 */
export const getCompanyStats = async (companyId: number): Promise<{
  documents: number;
  chunks: number;
  avgChunkSize: number;
  oldestDocument: Date | null;
  newestDocument: Date | null;
  tags: string[];
}> => {
  const [result] = await sequelize.query(`
    SELECT 
      COUNT(DISTINCT d.id) as documents,
      COUNT(c.id) as chunks,
      AVG(LENGTH(c.content)) as "avgChunkSize",
      MIN(d."createdAt") as "oldestDocument",
      MAX(d."createdAt") as "newestDocument"
    FROM "KnowledgeDocuments" d
    LEFT JOIN "KnowledgeChunks" c ON c."documentId" = d.id
    WHERE d."companyId" = :companyId
  `, {
    replacements: { companyId },
    type: QueryTypes.SELECT
  });

  const stats = result as any;

  // Busca tags únicas
  const [tagResult] = await sequelize.query(`
    SELECT DISTINCT tags
    FROM "KnowledgeDocuments"
    WHERE "companyId" = :companyId
    AND tags IS NOT NULL
    LIMIT 50
  `, {
    replacements: { companyId },
    type: QueryTypes.SELECT
  });

  const tags = new Set<string>();
  for (const row of tagResult as any[]) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) {
        parsed.forEach(t => tags.add(t));
      }
    } catch {}
  }

  return {
    documents: Number(stats.documents || 0),
    chunks: Number(stats.chunks || 0),
    avgChunkSize: Math.round(Number(stats.avgChunkSize || 0)),
    oldestDocument: stats.oldestDocument ? new Date(stats.oldestDocument) : null,
    newestDocument: stats.newestDocument ? new Date(stats.newestDocument) : null,
    tags: Array.from(tags)
  };
};

/**
 * Health check do RAG
 */
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { ok: boolean; message?: string }>;
}> => {
  const checks: Record<string, { ok: boolean; message?: string }> = {};

  // Verifica conexão com banco
  try {
    await sequelize.query('SELECT 1', { type: QueryTypes.SELECT });
    checks.database = { ok: true };
  } catch (error: any) {
    checks.database = { ok: false, message: error.message };
  }

  // Verifica se existem chunks
  try {
    const [result] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "KnowledgeChunks" LIMIT 1
    `, { type: QueryTypes.SELECT });
    const count = (result as any)[0]?.count || 0;
    checks.chunks = { 
      ok: count > 0, 
      message: count > 0 ? `${count} chunks indexados` : 'Nenhum chunk indexado'
    };
  } catch (error: any) {
    checks.chunks = { ok: false, message: error.message };
  }

  // Verifica índice HNSW
  try {
    const [result] = await sequelize.query(`
      SELECT indexname FROM pg_indexes 
      WHERE indexname = 'idx_knowledge_chunks_embedding_hnsw'
    `, { type: QueryTypes.SELECT });
    checks.hnswIndex = { 
      ok: (result as any[]).length > 0,
      message: (result as any[]).length > 0 ? 'Índice HNSW ativo' : 'Índice HNSW não encontrado'
    };
  } catch (error: any) {
    checks.hnswIndex = { ok: false, message: error.message };
  }

  // Verifica índice FTS
  try {
    const [result] = await sequelize.query(`
      SELECT indexname FROM pg_indexes 
      WHERE indexname = 'idx_knowledge_chunks_content_fts'
    `, { type: QueryTypes.SELECT });
    checks.ftsIndex = { 
      ok: (result as any[]).length > 0,
      message: (result as any[]).length > 0 ? 'Índice FTS ativo' : 'Índice FTS não encontrado'
    };
  } catch (error: any) {
    checks.ftsIndex = { ok: false, message: error.message };
  }

  // Determina status geral
  const allOk = Object.values(checks).every(c => c.ok);
  const criticalOk = checks.database?.ok && checks.chunks?.ok;

  const status = allOk ? 'healthy' : criticalOk ? 'degraded' : 'unhealthy';

  return { status, checks };
};

export default {
  logSearch,
  collectMetrics,
  getRecentLogs,
  clearOldLogs,
  getCompanyStats,
  healthCheck
};
