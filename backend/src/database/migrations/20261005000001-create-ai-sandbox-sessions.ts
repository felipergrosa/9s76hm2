import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Idempotente: pula a criação se a tabela já existir
    const existing = await queryInterface
      .describeTable("AISandboxSessions")
      .catch(() => null);
    if (existing) return;

    await queryInterface.createTable("AISandboxSessions", {
      id: {
        // uuid hex gerado pela aplicação
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "AIAgents",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "FunnelStages",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Whatsapps",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      groupId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      toNumber: {
        type: DataTypes.STRING,
        allowNull: true
      },
      simulate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      promptOverride: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      messages: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      expiresAt: {
        type: DataTypes.DATE(6),
        allowNull: false
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

    await queryInterface.addIndex("AISandboxSessions", ["companyId", "agentId"]);
    await queryInterface.addIndex("AISandboxSessions", ["expiresAt"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AISandboxSessions");
  }
};
