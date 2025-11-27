import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("Queues", "folderId", {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "LibraryFolders",
                key: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
        });
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("Queues", "folderId");
    }
};
