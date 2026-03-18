import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna companyId na tabela ContactTags
    await queryInterface.addColumn("ContactTags", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Companies",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    // Criar índice para performance
    await queryInterface.addIndex("ContactTags", ["companyId"]);

    // Atualizar registros existentes com companyId baseado no contato
    await queryInterface.sequelize.query(`
      UPDATE "ContactTags" ct
      SET "companyId" = c."companyId"
      FROM "Contacts" c
      WHERE ct."contactId" = c.id
      AND ct."companyId" IS NULL
    `);

    // Após migração, tornar obrigatório
    await queryInterface.changeColumn("ContactTags", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Companies",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("ContactTags", "companyId");
  }
};
