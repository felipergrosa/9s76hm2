import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Remove índice antigo se existir
    try {
      await queryInterface.removeIndex("Contacts", "contacts_number_company_id");
    } catch (err) {
      // Índice pode não existir, ignora erro
    }

    // Cria índice único composto por canonicalNumber + companyId
    // Isso garante que não haverá duplicatas do mesmo número normalizado na mesma empresa
    // Nota: índice parcial (where) não é suportado em addIndex, então criamos via SQL direto
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "contacts_canonical_number_company_id_unique"
      ON "Contacts" ("canonicalNumber", "companyId")
      WHERE "isGroup" = false AND "canonicalNumber" IS NOT NULL;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Contacts", "contacts_canonical_number_company_id_unique");
  }
};
