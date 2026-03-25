import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration para criar tabela de skills customizadas por agente
 */
export default {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("AIAgentSkills", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
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
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "communication"
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      triggers: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      examples: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      functions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      conditions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Índices para performance
    await queryInterface.addIndex("AIAgentSkills", ["agentId"]);
    await queryInterface.addIndex("AIAgentSkills", ["category"]);
    await queryInterface.addIndex("AIAgentSkills", ["enabled"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("AIAgentSkills");
  }
};
