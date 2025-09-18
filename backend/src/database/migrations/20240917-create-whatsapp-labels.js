const { QueryInterface, DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    // Primeiro, criar a tabela WhatsappLabels
    await queryInterface.createTable("WhatsappLabels", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      whatsappLabelId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      color: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      predefinedId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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

    // Depois, criar a tabela ContactWhatsappLabels
    await queryInterface.createTable("ContactWhatsappLabels", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappLabelId: {
        type: DataTypes.INTEGER,
        references: { model: "WhatsappLabels", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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

    // Por último, adicionar os índices
    await queryInterface.addIndex("WhatsappLabels", ["whatsappLabelId", "whatsappId"], {
      unique: true,
      name: "whatsapp_labels_unique"
    });

    await queryInterface.addIndex("ContactWhatsappLabels", ["contactId", "whatsappLabelId"], {
      unique: true,
      name: "contact_whatsapp_labels_unique"
    });
  },

  down: async (queryInterface) => {
    // Primeiro, remover a tabela dependente
    await queryInterface.dropTable("ContactWhatsappLabels");
    // Depois, remover a tabela principal
    await queryInterface.dropTable("WhatsappLabels");
  }
};
