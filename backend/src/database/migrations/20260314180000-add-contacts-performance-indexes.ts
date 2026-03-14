import { QueryInterface } from "sequelize";

/**
 * Migration: Índices Críticos para Performance de Contatos
 * 
 * Otimiza:
 * - ListContactsService: permissões de tags, filtros, busca
 * - Contagem de contatos por situação/canal/segmento
 * - Queries de carteira (wallet)
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // ═══════════════════════════════════════════════════════════
    // 1. ContactTags - CRÍTICO para permissões
    // ═══════════════════════════════════════════════════════════
    
    // Índice para buscar contatos por tag (permissões)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_tag_contact 
      ON "ContactTags" ("tagId", "contactId");
    `, { transaction: null });

    // Índice para JOIN com Contact
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_contact_tag 
      ON "ContactTags" ("contactId", "tagId");
    `, { transaction: null });

    // ═══════════════════════════════════════════════════════════
    // 2. Contacts - Filtros comuns
    // ═══════════════════════════════════════════════════════════
    
    // Filtro por conexão WhatsApp
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_whatsapp 
      ON "Contacts" ("companyId", "whatsappId");
    `, { transaction: null });

    // Filtro por situação (cliente, lead, etc.)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_situation 
      ON "Contacts" ("companyId", "situation");
    `, { transaction: null });

    // Filtro por canal (whatsapp, instagram, etc.)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_channel 
      ON "Contacts" ("companyId", "channel");
    `, { transaction: null });

    // Filtro por segmento
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_segment 
      ON "Contacts" ("companyId", "segment");
    `, { transaction: null });

    // Filtro por grupo vs contato
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_isgroup 
      ON "Contacts" ("companyId", "isGroup");
    `, { transaction: null });

    // Filtro por validação WhatsApp
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_whatsapp_valid 
      ON "Contacts" ("companyId", "isWhatsappValid");
    `, { transaction: null });

    // ═══════════════════════════════════════════════════════════
    // 3. Contacts - Busca por nome (trigram)
    // ═══════════════════════════════════════════════════════════
    
    // Verificar se extensão pg_trgm existe
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `, { transaction: null });

    // Índice GIN para busca por nome com LIKE/ilike
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_name_trgm 
      ON "Contacts" USING GIN (name gin_trgm_ops);
    `, { transaction: null });

    // Índice para busca por número (parcial)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_number_trgm 
      ON "Contacts" USING GIN (number gin_trgm_ops);
    `, { transaction: null });

    // ═══════════════════════════════════════════════════════════
    // 4. Contacts - Campos adicionais
    // ═══════════════════════════════════════════════════════════
    
    // Filtro por cidade
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_city 
      ON "Contacts" ("companyId", "city");
    `, { transaction: null });

    // Filtro por representante
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_representative 
      ON "Contacts" ("companyId", "representativeCode");
    `, { transaction: null });

    // Filtro por empresa (B2B)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_empresa 
      ON "Contacts" ("companyId", "bzEmpresa");
    `, { transaction: null });

    // ═══════════════════════════════════════════════════════════
    // 5. VACUUM ANALYZE
    // ═══════════════════════════════════════════════════════════
    
    await queryInterface.sequelize.query(`
      VACUUM ANALYZE "Contacts";
    `, { transaction: null });

    await queryInterface.sequelize.query(`
      VACUUM ANALYZE "ContactTags";
    `, { transaction: null });
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contact_tags_tag_contact;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contact_tags_contact_tag;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_whatsapp;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_situation;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_channel;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_segment;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_isgroup;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_whatsapp_valid;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_name_trgm;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_number_trgm;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_city;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_representative;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_empresa;`, { transaction: null })
    ]);
  }
};
