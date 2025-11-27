import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.addColumn("Campaigns", "metaTemplateVariables", {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            comment: "JSON mapping of template variables to CRM fields or special values"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeColumn("Campaigns", "metaTemplateVariables");
    }
};
