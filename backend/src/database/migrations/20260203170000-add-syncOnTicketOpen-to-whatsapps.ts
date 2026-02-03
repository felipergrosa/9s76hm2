"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn("Whatsapps", "syncOnTicketOpen", {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn("Whatsapps", "syncOnTicketOpen");
    }
};
