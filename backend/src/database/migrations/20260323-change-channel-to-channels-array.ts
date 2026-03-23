import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Renomear coluna channel para channels
    await queryInterface.renameColumn("Contacts", "channel", "channels");
    
    // Alterar tipo para ARRAY de strings (PostgreSQL)
    await queryInterface.changeColumn("Contacts", "channels", {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    });

    // Migrar dados existentes: converter string única para array
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" 
      SET "channels" = ARRAY["channels"] 
      WHERE "channels" IS NOT NULL AND "channels" != ''
    `);

    // Definir array com whatsapp onde era NULL ou vazio
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" 
      SET "channels" = ARRAY['whatsapp']::VARCHAR[] 
      WHERE "channels" IS NULL OR "channels" = ''
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    // Reverter: converter array de volta para string (pega o primeiro elemento)
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" 
      SET "channels" = COALESCE("channels"[1], 'whatsapp')
    `);

    // Alterar tipo de volta para STRING
    await queryInterface.changeColumn("Contacts", "channels", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "whatsapp"
    });

    // Renomear de volta para channel
    await queryInterface.renameColumn("Contacts", "channels", "channel");
  }
};
