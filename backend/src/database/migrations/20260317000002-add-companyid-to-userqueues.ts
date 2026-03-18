import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna companyId na tabela UserQueues
    await queryInterface.addColumn("UserQueues", "companyId", {
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
    await queryInterface.addIndex("UserQueues", ["companyId"]);

    // Atualizar registros existentes com companyId baseado no usuário
    await queryInterface.sequelize.query(`
      UPDATE "UserQueues" uq
      SET "companyId" = u."companyId"
      FROM "Users" u
      WHERE uq."userId" = u.id
      AND uq."companyId" IS NULL
    `);

    // Após migração, tornar obrigatório
    await queryInterface.changeColumn("UserQueues", "companyId", {
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
    await queryInterface.removeColumn("UserQueues", "companyId");
  }
};
