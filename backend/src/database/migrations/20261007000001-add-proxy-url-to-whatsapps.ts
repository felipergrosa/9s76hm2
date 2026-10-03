import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";

    // Proxy por conexão (ex.: http://user:pass@host:port ou socks5://host:port).
    // Permite associar um IP dedicado a cada número Baileys, prática que a
    // comunidade aponta como a mais eficaz para isolar reputação de sessão.
    const tableDefinition: any = await queryInterface.describeTable(table);
    if (!tableDefinition.proxyUrl) {
      await queryInterface.addColumn(table, "proxyUrl", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "proxyUrl");
  }
};
