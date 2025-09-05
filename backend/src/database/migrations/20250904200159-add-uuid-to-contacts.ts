import { QueryInterface, DataTypes, Sequelize } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await queryInterface.addColumn("Contacts", "uuid", {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: require('sequelize').UUIDV4,
    });
    // Opcional: índice para buscas por uuid
    await queryInterface.addIndex("Contacts", ["uuid"], { unique: false, name: "contacts_uuid_idx" });
    // Backfill para registros existentes
    await queryInterface.sequelize.query('UPDATE "Contacts" SET "uuid" = uuid_generate_v4() WHERE "uuid" IS NULL;');
    // Tornar não nulo após backfill
    await queryInterface.changeColumn("Contacts", "uuid", {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: require('sequelize').UUIDV4,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Contacts", "contacts_uuid_idx");
    await queryInterface.removeColumn("Contacts", "uuid");
  }
};
