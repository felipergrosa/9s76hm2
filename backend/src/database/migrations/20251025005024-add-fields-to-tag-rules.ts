import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adiciona campo logic
    await queryInterface.addColumn("TagRules", "logic", {
      type: DataTypes.STRING,
      defaultValue: "AND",
      allowNull: false
    });

    // Adiciona campo lastAppliedAt
    await queryInterface.addColumn("TagRules", "lastAppliedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    // Adiciona campo lastContactsAffected
    await queryInterface.addColumn("TagRules", "lastContactsAffected", {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("TagRules", "logic");
    await queryInterface.removeColumn("TagRules", "lastAppliedAt");
    await queryInterface.removeColumn("TagRules", "lastContactsAffected");
  }
};
