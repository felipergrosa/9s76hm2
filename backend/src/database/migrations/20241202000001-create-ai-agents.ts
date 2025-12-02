import { QueryInterface, DataTypes } from "sequelize";

export default {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("AIAgents", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            companyId: {
                type: DataTypes.INTEGER,
                references: { model: "Companies", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            profile: {
                type: DataTypes.ENUM("sales", "support", "service", "hybrid"),
                allowNull: false
            },
            queueIds: {
                type: DataTypes.JSON,
                allowNull: true
            },
            voiceEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            imageRecognitionEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            sentimentAnalysisEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            autoSegmentationEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                defaultValue: "active"
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
        await queryInterface.dropTable("AIAgents");
    }
};
