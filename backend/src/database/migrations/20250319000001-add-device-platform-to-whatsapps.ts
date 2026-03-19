import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna devicePlatform com default 'android'
    await queryInterface.addColumn("Whatsapps", "devicePlatform", {
      type: DataTypes.STRING(10),
      defaultValue: "android",
      allowNull: true
    });

    // Atualizar registros existentes baseado no ID conhecido
    // whatsappId=31 = Android
    // whatsappId=32 = iOS
    await queryInterface.sequelize.query(`
      UPDATE "Whatsapps" SET "devicePlatform" = 'ios' WHERE id = 32
    `);
    
    await queryInterface.sequelize.query(`
      UPDATE "Whatsapps" SET "devicePlatform" = 'android' WHERE id = 31 OR "devicePlatform" IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "devicePlatform");
  }
};
