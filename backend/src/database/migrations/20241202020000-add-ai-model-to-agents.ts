import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Adicionar campos de modelo/provider que faltavam
        await queryInterface.addColumn("AIAgents", "aiProvider", {
            type: DataTypes.ENUM("openai", "gemini"),
            allowNull: true,
            comment: "Se null, usa configuração global"
        });

        await queryInterface.addColumn("AIAgents", "aiModel", {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Se null, usa configuração global. Ex: gpt-4, gpt-3.5-turbo, gemini-pro"
        });

        await queryInterface.addColumn("AIAgents", "temperature", {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: "Se null, usa configuração global"
        });

        await queryInterface.addColumn("AIAgents", "maxTokens", {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "Se null, usa configuração global"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeColumn("AIAgents", "aiProvider");
        await queryInterface.removeColumn("AIAgents", "aiModel");
        await queryInterface.removeColumn("AIAgents", "temperature");
        await queryInterface.removeColumn("AIAgents", "maxTokens");
    }
};
