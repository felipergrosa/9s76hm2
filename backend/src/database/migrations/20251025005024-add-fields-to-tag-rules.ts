import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable("TagRules");

    // Adiciona campo logic apenas se não existir
    if (!table["logic"]) {
      await queryInterface.addColumn("TagRules", "logic", {
        type: DataTypes.STRING,
        defaultValue: "AND",
        allowNull: false
      });
    }

    // Adiciona campo lastAppliedAt apenas se não existir
    if (!table["lastAppliedAt"]) {
      await queryInterface.addColumn("TagRules", "lastAppliedAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }

    // Adiciona campo lastContactsAffected apenas se não existir
    if (!table["lastContactsAffected"]) {
      await queryInterface.addColumn("TagRules", "lastContactsAffected", {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable("TagRules");

    if (table["logic"]) {
      await queryInterface.removeColumn("TagRules", "logic");
    }
    if (table["lastAppliedAt"]) {
      await queryInterface.removeColumn("TagRules", "lastAppliedAt");
    }
    if (table["lastContactsAffected"]) {
      await queryInterface.removeColumn("TagRules", "lastContactsAffected");
    }
  }
};
