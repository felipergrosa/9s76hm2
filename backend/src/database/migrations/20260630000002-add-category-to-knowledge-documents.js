const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    const cols = await queryInterface.describeTable("KnowledgeDocuments").catch(() => null);
    if (cols && !cols.category) {
      await queryInterface.addColumn("KnowledgeDocuments", "category", {
        type: DataTypes.STRING(50),
        defaultValue: "general",
        allowNull: false
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("KnowledgeDocuments", "category");
  }
};
