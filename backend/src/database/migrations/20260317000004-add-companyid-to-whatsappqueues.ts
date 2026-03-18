import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna companyId na tabela WhatsappQueues (se não existir)
    const tableInfo: any = await queryInterface.describeTable("WhatsappQueues");
    if (!tableInfo.companyId) {
      await queryInterface.addColumn("WhatsappQueues", "companyId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      });

      // Criar índice para performance
      await queryInterface.addIndex("WhatsappQueues", ["companyId"]);
    }

    // Atualizar registros existentes com companyId baseado no whatsapp
    await queryInterface.sequelize.query(`
      UPDATE "WhatsappQueues" wq
      SET "companyId" = w."companyId"
      FROM "Whatsapps" w
      WHERE wq."whatsappId" = w.id
      AND wq."companyId" IS NULL
    `);

    // Remover registros órfãos (que não conseguiram companyId)
    await queryInterface.sequelize.query(`
      DELETE FROM "WhatsappQueues"
      WHERE "companyId" IS NULL
    `);

    // Após migração e limpeza, tornar obrigatório
    await queryInterface.changeColumn("WhatsappQueues", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Companies",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WhatsappQueues", "companyId");
  }
};
