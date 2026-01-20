import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("Tags", "userId", {
            type: DataTypes.INTEGER,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
            allowNull: true,
            defaultValue: null
        });
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("Tags", "userId");
    }
};
