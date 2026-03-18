import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna companyId na tabela TicketTags
    await queryInterface.addColumn("TicketTags", "companyId", {
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
    await queryInterface.addIndex("TicketTags", ["companyId"]);

    // Atualizar registros existentes com companyId baseado no ticket
    await queryInterface.sequelize.query(`
      UPDATE "TicketTags" tt
      SET "companyId" = t."companyId"
      FROM "Tickets" t
      WHERE tt."ticketId" = t.id
      AND tt."companyId" IS NULL
    `);

    // Após migração, tornar obrigatório
    await queryInterface.changeColumn("TicketTags", "companyId", {
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
    await queryInterface.removeColumn("TicketTags", "companyId");
  }
};
