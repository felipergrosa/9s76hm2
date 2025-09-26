import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("Contacts");
      
      // Adicionar coluna bzEmpresa
      if (!table["bzEmpresa"]) {
        await queryInterface.addColumn(
          "Contacts",
          "bzEmpresa",
          {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("Contacts");
      
      if (table["bzEmpresa"]) {
        await queryInterface.removeColumn("Contacts", "bzEmpresa", { transaction });
      }
    });
  },
};
