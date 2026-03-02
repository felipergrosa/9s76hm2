import { QueryInterface, DataTypes, Op } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adiciona coluna nameNormalized
    try {
      await queryInterface.addColumn("Contacts", "nameNormalized", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    } catch (e) {
      // Coluna já existe
    }

    // Adiciona coluna cpfCnpjNormalized
    try {
      await queryInterface.addColumn("Contacts", "cpfCnpjNormalized", {
        type: DataTypes.STRING(20),
        allowNull: true
      });
    } catch (e) {
      // Coluna já existe
    }

    // Popula colunas existentes
    await queryInterface.sequelize.query(`
      UPDATE "Contacts"
      SET "nameNormalized" = LOWER(unaccent(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')))
      WHERE "nameNormalized" IS NULL AND name IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Contacts"
      SET "cpfCnpjNormalized" = REGEXP_REPLACE("cpfCnpj", '[^0-9]', '', 'g')
      WHERE "cpfCnpjNormalized" IS NULL AND "cpfCnpj" IS NOT NULL;
    `);

    // Cria índices para busca otimizada
    try {
      await queryInterface.addIndex("Contacts", ["nameNormalized"], {
        name: "idx_contacts_name_normalized"
      });
    } catch (e) {
      // Índice já existe
    }

    try {
      await queryInterface.addIndex("Contacts", ["cpfCnpjNormalized", "companyId"], {
        name: "idx_contacts_cpfcnpj_normalized_company"
      });
    } catch (e) {
      // Índice já existe
    }

    // Índice para busca por código do cliente
    try {
      await queryInterface.addIndex("Contacts", ["clientCode", "companyId"], {
        name: "idx_contacts_clientcode_company"
      });
    } catch (e) {
      // Índice já existe
    }

    // Cria trigger para manter colunas atualizadas
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION normalize_contact_search_fields()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."nameNormalized" := LOWER(unaccent(REGEXP_REPLACE(COALESCE(NEW.name, ''), '[^a-zA-Z0-9]', '', 'g')));
        NEW."cpfCnpjNormalized" := REGEXP_REPLACE(COALESCE(NEW."cpfCnpj", ''), '[^0-9]', '', 'g');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trigger_normalize_contact_search ON "Contacts";
      CREATE TRIGGER trigger_normalize_contact_search
      BEFORE INSERT OR UPDATE OF name, "cpfCnpj" ON "Contacts"
      FOR EACH ROW
      EXECUTE FUNCTION normalize_contact_search_fields();
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trigger_normalize_contact_search ON "Contacts";
      DROP FUNCTION IF EXISTS normalize_contact_search_fields();
    `);

    try {
      await queryInterface.removeIndex("Contacts", "idx_contacts_name_normalized");
    } catch (e) {}

    try {
      await queryInterface.removeIndex("Contacts", "idx_contacts_cpfcnpj_normalized_company");
    } catch (e) {}

    try {
      await queryInterface.removeColumn("Contacts", "nameNormalized");
    } catch (e) {}

    try {
      await queryInterface.removeColumn("Contacts", "cpfCnpjNormalized");
    } catch (e) {}
  }
};
