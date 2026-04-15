import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Skills", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
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
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "AIAgents",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      category: {
        type: DataTypes.ENUM(
          "communication",
          "sales",
          "support",
          "crm",
          "routing",
          "sdr",
          "rag",
          "scheduling",
          "custom"
        ),
        defaultValue: "custom"
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      triggers: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      examples: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      functions: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      conditions: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 5
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      version: {
        type: DataTypes.STRING,
        defaultValue: "1.0.0"
      },
      hash: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "deprecated"),
        defaultValue: "draft"
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
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

    // Índices para performance
    await queryInterface.addIndex("Skills", ["companyId", "agentId"]);
    await queryInterface.addIndex("Skills", ["companyId", "category"]);
    await queryInterface.addIndex("Skills", ["hash"]);
    await queryInterface.addIndex("Skills", ["status", "enabled"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Skills");
  }
};
