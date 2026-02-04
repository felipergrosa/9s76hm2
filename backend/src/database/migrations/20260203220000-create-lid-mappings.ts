"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable("LidMappings", {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            lid: {
                type: Sequelize.STRING,
                allowNull: false
            },
            phoneNumber: {
                type: Sequelize.STRING,
                allowNull: false
            },
            companyId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: "Companies", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            whatsappId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "Whatsapps", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        // Índice único para evitar duplicatas
        await queryInterface.addIndex("LidMappings", ["lid", "companyId"], {
            unique: true,
            name: "lid_mappings_lid_company_unique"
        });

        // Índice para busca por número
        await queryInterface.addIndex("LidMappings", ["phoneNumber", "companyId"], {
            name: "lid_mappings_phone_company"
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable("LidMappings");
    }
};
