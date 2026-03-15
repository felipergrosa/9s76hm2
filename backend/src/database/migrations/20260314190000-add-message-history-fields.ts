import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration: Adiciona campos para suporte completo ao histórico de mensagens
 * 
 * Campos adicionados:
 * - editedTimestamp: timestamp da última edição (Baileys v7)
 * - reactions: JSON com reações da mensagem
 * - pollData: JSON com dados de enquete (poll)
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Adicionar editedTimestamp para mensagens editadas
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" 
      ADD COLUMN IF NOT EXISTS "editedTimestamp" BIGINT DEFAULT NULL;
    `, { transaction: null });

    // 2. Adicionar reactions (JSON) para armazenar reações
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" 
      ADD COLUMN IF NOT EXISTS "reactions" JSONB DEFAULT NULL;
    `, { transaction: null });

    // 3. Adicionar pollData (JSON) para enquetes
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" 
      ADD COLUMN IF NOT EXISTS "pollData" JSONB DEFAULT NULL;
    `, { transaction: null });

    // 4. Criar índice para mensagens editadas
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_edited 
      ON "Messages" ("ticketId", "editedTimestamp") 
      WHERE "editedTimestamp" IS NOT NULL;
    `, { transaction: null });

    // 5. Criar índice GIN para busca em reactions
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_reactions 
      ON "Messages" USING GIN ("reactions") 
      WHERE "reactions" IS NOT NULL;
    `, { transaction: null });

    console.log("✅ Campos de histórico adicionados: editedTimestamp, reactions, pollData");
  },

  down: async (queryInterface: QueryInterface) => {
    // Remover índices
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_messages_edited;
    `, { transaction: null });

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_messages_reactions;
    `, { transaction: null });

    // Remover colunas
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" DROP COLUMN IF EXISTS "editedTimestamp";
    `, { transaction: null });

    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" DROP COLUMN IF EXISTS "reactions";
    `, { transaction: null });

    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" DROP COLUMN IF EXISTS "pollData";
    `, { transaction: null });
  }
};
