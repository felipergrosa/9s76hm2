
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Users", "allowedConnectionIds", {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                defaultValue: []
            }),
            queryInterface.addColumn("Users", "isPrivate", {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            })
        ]);
    },

    down: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Users", "allowedConnectionIds"),
            queryInterface.removeColumn("Users", "isPrivate")
        ]);
    }
};
