import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WhatsappTemplates";

    const tableInfo: any = await queryInterface.showAllTables();
    if (Array.isArray(tableInfo) && tableInfo.map(String).includes(table)) {
      return;
    }

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      metaTemplateId: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      language: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      category: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      parameterFormat: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      components: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      rejectedReason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Unicidade: um template Meta por conexão
    await queryInterface.addIndex(table, ["whatsappId", "metaTemplateId"], {
      unique: true,
      name: "whatsapp_templates_whatsapp_meta_id_uk"
    });

    // Busca por empresa + conexão
    await queryInterface.addIndex(table, ["companyId", "whatsappId"], {
      name: "whatsapp_templates_company_whatsapp_idx"
    });

    // Busca por nome + idioma dentro da conexão
    await queryInterface.addIndex(table, ["whatsappId", "name", "language"], {
      name: "whatsapp_templates_whatsapp_name_language_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("WhatsappTemplates");
  }
};
