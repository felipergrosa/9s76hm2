import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration: Adiciona índice único para deduplicação de mensagens
 * 
 * IMPORTANTE: Com múltiplas conexões do mesmo número (Multi-Device WhatsApp),
 * a mesma mensagem pode chegar em múltiplas conexões simultaneamente.
 * 
 * Este índice garante que apenas UMA mensagem seja salva por (wid, companyId),
 * evitando duplicação no banco de dados.
 * 
 * O índice permite que:
 * - DEV e PROD recebam a mesma mensagem simultaneamente
 * - Apenas uma seja salva no banco (deduplicação automática)
 * - Histórico permaneça consistente entre todas as conexões
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const indexName = "messages_wid_company_id_unique";
    
    try {
      // =================================================================
      // REMOVER DUPLICADOS EXISTENTES ANTES DE CRIAR ÍNDICE
      // =================================================================
      if (dialect === "postgres") {
        // PostgreSQL: Remove duplicados mantendo o mais recente
        await queryInterface.sequelize.query(`
          DELETE FROM "Messages" m1
          WHERE EXISTS (
            SELECT 1 FROM "Messages" m2
            WHERE m2."wid" = m1."wid"
            AND m2."companyId" = m1."companyId"
            AND m2."id" > m1."id"
          )
        `);
      } else if (dialect === "mysql" || dialect === "mariadb") {
        // MySQL/MariaDB: Remove duplicados mantendo o mais recente
        await queryInterface.sequelize.query(`
          DELETE m1 FROM Messages m1
          INNER JOIN Messages m2
          WHERE m1.wid = m2.wid
          AND m1.companyId = m2.companyId
          AND m1.id < m2.id
        `);
      }
      
      // =================================================================
      // CRIAR ÍNDICE ÚNICO
      // =================================================================
      await queryInterface.addIndex("Messages", ["wid", "companyId"], {
        name: indexName,
        unique: true
      });
      
      console.log(`[Migration] ✅ Índice único ${indexName} criado com sucesso`);
      
    } catch (err: any) {
      // Se índice já existe, ignorar erro
      if (err.message?.includes("already exists") || err.message?.includes("Duplicate key") || err.message?.includes("Validation error")) {
        console.log(`[Migration] ⚠️ Índice ${indexName} já existe ou duplicados removidos, ignorando`);
        return;
      }
      throw err;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexName = "messages_wid_company_id_unique";
    
    try {
      await queryInterface.removeIndex("Messages", indexName);
      console.log(`[Migration] ✅ Índice ${indexName} removido`);
    } catch (err: any) {
      console.log(`[Migration] ⚠️ Erro ao remover índice: ${err.message}`);
    }
  }
};
