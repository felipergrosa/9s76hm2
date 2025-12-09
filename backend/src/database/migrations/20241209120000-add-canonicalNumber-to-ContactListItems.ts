import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verificar se a coluna já existe
    const tableInfo = await queryInterface.describeTable("ContactListItems") as Record<string, any>;
    
    if (!tableInfo.canonicalNumber) {
      await queryInterface.addColumn("ContactListItems", "canonicalNumber", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    // Criar índice para melhorar performance das buscas
    try {
      await queryInterface.addIndex("ContactListItems", ["canonicalNumber", "companyId"], {
        name: "idx_contactlistitems_canonical_company"
      });
    } catch (e) {
      // Índice pode já existir
      console.log("Índice idx_contactlistitems_canonical_company já existe ou erro:", e);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeIndex("ContactListItems", "idx_contactlistitems_canonical_company");
    } catch (e) {
      // Ignora se não existir
    }
    
    await queryInterface.removeColumn("ContactListItems", "canonicalNumber");
  }
};
