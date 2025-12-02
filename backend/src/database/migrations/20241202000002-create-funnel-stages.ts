import { QueryInterface, DataTypes } from "sequelize";

export default {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("FunnelStages", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            agentId: {
                type: DataTypes.INTEGER,
                references: { model: "AIAgents", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            order: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            tone: {
                type: DataTypes.STRING,
                allowNull: false
            },
            objective: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            systemPrompt: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            enabledFunctions: {
                type: DataTypes.JSON,
                allowNull: true
            },
            autoAdvanceCondition: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            sentimentThreshold: {
                type: DataTypes.FLOAT,
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
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("FunnelStages");
    }
};
