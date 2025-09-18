import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Check if pgvector extension is available
    let hasPgVector = false;
    try {
      const [results] = await queryInterface.sequelize.query(`
        SELECT name FROM pg_available_extensions WHERE name = 'vector'
      `);
      hasPgVector = results && results.length > 0;
    } catch (error) {
      console.warn('Could not check for pgvector extension:', error.message);
    }

    const tableDefinition: any = {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      documentId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      chunkIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      embedding: hasPgVector ? {
        // pgvector column - text-embedding-3-small (1536 dims)
        type: "vector(1536)" as any,
        allowNull: true
      } : {
        // Fallback: store as JSON string when pgvector is not available
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Embedding stored as JSON string (pgvector not available)'
      },
      score: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    };

    await queryInterface.createTable("KnowledgeChunks", tableDefinition);

    await queryInterface.addIndex("KnowledgeChunks", ["companyId"], { name: "knowledge_chunks_company_idx" });
    await queryInterface.addIndex("KnowledgeChunks", ["documentId"], { name: "knowledge_chunks_document_idx" });

    // Only create vector index if pgvector is available
    if (hasPgVector) {
      try {
        // ivfflat index for ANN on pgvector (cosine distance)
        await queryInterface.sequelize.query(
          'CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_ivfflat ON "KnowledgeChunks" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)'
        );
        console.log('Vector index created successfully');
      } catch (error) {
        console.warn('Failed to create vector index:', error.message);
      }
    } else {
      console.warn('pgvector not available. Vector search functionality will be limited.');
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("KnowledgeChunks");
  }
};
