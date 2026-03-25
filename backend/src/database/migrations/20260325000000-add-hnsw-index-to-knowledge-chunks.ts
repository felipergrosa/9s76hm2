import { QueryInterface } from "sequelize";

/**
 * Migration para adicionar índice HNSW no pgvector
 * Melhora performance de busca em ~10x para bases grandes
 * 
 * NOTA: Requer extensão pgvector instalada no PostgreSQL.
 * Se não estiver disponível, a migration pula o índice HNSW silenciosamente.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    
    // Tenta criar extensão pgvector (pode falhar se não estiver instalada no servidor)
    let pgvectorAvailable = false;
    try {
      await sequelize.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      pgvectorAvailable = true;
      console.log("[Migration] Extensão pgvector disponível");
    } catch (err: any) {
      console.log("[Migration] ⚠️  Extensão pgvector não disponível - pulando índice HNSW");
      console.log("[Migration] Para habilitar, instale pgvector no PostgreSQL: https://github.com/pgvector/pgvector");
    }
    
    // Cria índice HNSW apenas se pgvector estiver disponível
    if (pgvectorAvailable) {
      try {
        console.log("[Migration] Criando índice HNSW para embeddings...");
        await sequelize.query(`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
          ON "KnowledgeChunks" 
          USING hnsw (embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
        `);
        console.log("[Migration] ✅ Índice HNSW criado");
      } catch (err: any) {
        console.log("[Migration] ⚠️  Erro ao criar índice HNSW (ignorando):", err.message);
      }
    }
    
    // Cria índice GIN para busca full-text (não requer pgvector)
    try {
      console.log("[Migration] Criando índice GIN para full-text search...");
      await sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_content_fts
        ON "KnowledgeChunks" 
        USING gin (to_tsvector('portuguese', content))
      `);
      console.log("[Migration] ✅ Índice GIN criado");
    } catch (err: any) {
      console.log("[Migration] ⚠️  Erro ao criar índice GIN (ignorando):", err.message);
    }
    
    // Índice composto para filtros comuns
    try {
      await sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_company_doc
        ON "KnowledgeChunks" ("companyId", "documentId")
      `);
      console.log("[Migration] ✅ Índice composto criado");
    } catch (err: any) {
      console.log("[Migration] ⚠️  Erro ao criar índice composto (ignorando):", err.message);
    }
    
    console.log("[Migration] Migração concluída");
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    
    const indexes = [
      'idx_knowledge_chunks_embedding_hnsw',
      'idx_knowledge_chunks_content_fts',
      'idx_knowledge_chunks_company_doc'
    ];
    
    for (const idx of indexes) {
      try {
        await sequelize.query(`DROP INDEX IF EXISTS ${idx}`);
      } catch (err: any) {
        console.log(`[Migration] Erro ao remover ${idx} (ignorando):`, err.message);
      }
    }
    
    console.log("[Migration] Índices removidos");
  }
};
