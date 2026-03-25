import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verifica se a coluna 'channels' já existe (migration já executada)
    const [columns] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Contacts' AND column_name = 'channels'
    `);
    
    if ((columns as any[]).length > 0) {
      console.log("Coluna 'channels' já existe. Migration já foi aplicada.");
      return;
    }

    // Verifica se a coluna 'channel' antiga existe
    const [oldColumn] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Contacts' AND column_name = 'channel'
    `);

    // Se não existe channel nem channels, cria channels do zero
    if ((oldColumn as any[]).length === 0) {
      console.log("Coluna 'channel' não existe. Criando 'channels' do zero.");
      await queryInterface.addColumn("Contacts", "channels", {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: ["whatsapp"]
      });
      
      await queryInterface.sequelize.query(`
        UPDATE "Contacts" SET "channels" = ARRAY['whatsapp']::VARCHAR[] WHERE "channels" IS NULL
      `);
    } else {
      // Passo 1: Criar nova coluna channels_new como ARRAY
      await queryInterface.addColumn("Contacts", "channels_new", {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
      });

      // Passo 2: Migrar dados de channel para channels_new
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
    }

    // Passo 5: Criar índice GIN para a nova coluna
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
