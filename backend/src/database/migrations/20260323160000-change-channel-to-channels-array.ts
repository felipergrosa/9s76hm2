import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Passo 1: Criar nova coluna channels_new como ARRAY
    await queryInterface.addColumn("Contacts", "channels_new", {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    });

    // Passo 2: Migrar dados de channel para channels_new
    // Converte string única para array, NULL ou vazio vira ['whatsapp']
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" 
      SET "channels_new" = CASE 
        WHEN "channel" IS NULL OR "channel" = '' THEN ARRAY['whatsapp']::VARCHAR[]
        ELSE ARRAY["channel"]::VARCHAR[]
      END
    `);

    // Passo 3: Remover coluna channel antiga
    await queryInterface.removeColumn("Contacts", "channel");

    // Passo 4: Renomear channels_new para channels
    await queryInterface.renameColumn("Contacts", "channels_new", "channels");

    // Passo 5: Criar índice GIN para a nova coluna (otimiza buscas em arrays)
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_channels ON "Contacts" USING GIN ("channels");
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    // Passo 1: Criar coluna channel_new como TEXT
    await queryInterface.addColumn("Contacts", "channel_new", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "whatsapp"
    });

    // Passo 2: Migrar dados de channels para channel_new
    // Pega o primeiro elemento do array ou 'whatsapp' se vazio
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" 
      SET "channel_new" = COALESCE("channels"[1], 'whatsapp')
    `);

    // Passo 3: Remover coluna channels
    await queryInterface.removeColumn("Contacts", "channels");

    // Passo 4: Renomear channel_new para channel
    await queryInterface.renameColumn("Contacts", "channel_new", "channel");

    // Passo 5: Remover índice
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_contacts_channels;
    `);
  }
};
