import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Contacts");
    if (!(tableDesc as any)["username"]) {
      await queryInterface.addColumn("Contacts", "username", {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "@ handle do WhatsApp do contato (novo no rc10 do Baileys, nem todos têm)"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeColumn("Contacts", "username");
    } catch (e) {
      // ignorar se não existir
    }
  }
};
