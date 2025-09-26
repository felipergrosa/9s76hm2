import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("Contacts");
      
      // Se a coluna empresa existe, renomear para bzEmpresa
      if (table["empresa"] && !table["bzEmpresa"]) {
        await queryInterface.renameColumn("Contacts", "empresa", "bzEmpresa", { transaction });
      }
      // Se não existe empresa mas não existe bzEmpresa, criar bzEmpresa
      else if (!table["empresa"] && !table["bzEmpresa"]) {
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
      
      // Renomear bzEmpresa de volta para empresa
      if (table["bzEmpresa"]) {
        await queryInterface.renameColumn("Contacts", "bzEmpresa", "empresa", { transaction });
      }
    });
  },
};
