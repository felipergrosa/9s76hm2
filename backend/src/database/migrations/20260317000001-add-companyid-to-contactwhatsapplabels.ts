import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna companyId na tabela ContactWhatsappLabels
    await queryInterface.addColumn("ContactWhatsappLabels", "companyId", {
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
    await queryInterface.addIndex("ContactWhatsappLabels", ["companyId"]);

    // Atualizar registros existentes com companyId baseado no contato
    await queryInterface.sequelize.query(`
      UPDATE "ContactWhatsappLabels" cwl
      SET "companyId" = c."companyId"
      FROM "Contacts" c
      WHERE cwl."contactId" = c.id
      AND cwl."companyId" IS NULL
    `);

    // Após migração, tornar obrigatório
    await queryInterface.changeColumn("ContactWhatsappLabels", "companyId", {
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
    await queryInterface.removeColumn("ContactWhatsappLabels", "companyId");
  }
};
