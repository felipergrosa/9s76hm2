import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.addColumn("AIAgents", "creativity", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "medium"
        });

        await queryInterface.addColumn("AIAgents", "toneStyle", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "professional"
        });

        await queryInterface.addColumn("AIAgents", "emojiUsage", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "medium"
        });

        await queryInterface.addColumn("AIAgents", "hashtagUsage", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "none"
        });

        await queryInterface.addColumn("AIAgents", "responseLength", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "medium"
        });

        await queryInterface.addColumn("AIAgents", "language", {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "pt-BR"
        });

        await queryInterface.addColumn("AIAgents", "brandVoice", {
            type: DataTypes.TEXT,
            allowNull: true
        });

        await queryInterface.addColumn("AIAgents", "allowedVariables", {
            type: DataTypes.TEXT,
            allowNull: true
        });

        // Voice/TTS Settings
        await queryInterface.addColumn("AIAgents", "voiceType", {
            type: DataTypes.ENUM("text", "generated", "enabled"),
            allowNull: true,
            defaultValue: "text"
        });

        await queryInterface.addColumn("AIAgents", "voiceApiKey", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("AIAgents", "voiceRegion", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("AIAgents", "voiceTemperature", {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: 0.7
        });

        await queryInterface.addColumn("AIAgents", "voiceName", {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Azure voice name like pt-BR-FranciscaNeural"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeColumn("AIAgents", "creativity");
        await queryInterface.removeColumn("AIAgents", "toneStyle");
        await queryInterface.removeColumn("AIAgents", "emojiUsage");
        await queryInterface.removeColumn("AIAgents", "hashtagUsage");
        await queryInterface.removeColumn("AIAgents", "responseLength");
        await queryInterface.removeColumn("AIAgents", "language");
        await queryInterface.removeColumn("AIAgents", "brandVoice");
        await queryInterface.removeColumn("AIAgents", "allowedVariables");
        await queryInterface.removeColumn("AIAgents", "voiceType");
        await queryInterface.removeColumn("AIAgents", "voiceApiKey");
        await queryInterface.removeColumn("AIAgents", "voiceRegion");
        await queryInterface.removeColumn("AIAgents", "voiceTemperature");
        await queryInterface.removeColumn("AIAgents", "voiceName");
    }
};
