import { QueryInterface } from "sequelize";

/**
 * Migration para adicionar índice HNSW no pgvector
 * Melhora performance de busca em ~10x para bases grandes
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    
    // Verifica se a extensão pgvector está instalada
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    
    // Cria índice HNSW para busca de similaridade (cosine)
    // m = 16: número de conexões por nó (balanceia memória/precisão)
    // ef_construction = 64: tamanho da lista dinâmica durante construção
    console.log("[Migration] Criando índice HNSW para embeddings...");
    
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
      ON "KnowledgeChunks" 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    
    // Cria índice GIN para busca full-text (keyword search)
    console.log("[Migration] Criando índice GIN para full-text search...");
    
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_content_fts
      ON "KnowledgeChunks" 
      USING gin (to_tsvector('portuguese', content))
    `);
    
    // Índice composto para filtros comuns
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_company_doc
      ON "KnowledgeChunks" ("companyId", "documentId")
    `);
    
    console.log("[Migration] Índices HNSW e GIN criados com sucesso");
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    
    await sequelize.query(`DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw`);
    await sequelize.query(`DROP INDEX IF EXISTS idx_knowledge_chunks_content_fts`);
    await sequelize.query(`DROP INDEX IF EXISTS idx_knowledge_chunks_company_doc`);
    
    console.log("[Migration] Índices removidos");
  }
};
