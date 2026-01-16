import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.addColumn("Contacts", "clientCode", {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "Código do Cliente - identificador único do cliente no sistema externo"
        });

        // Criar índice para buscas rápidas pelo código do cliente
        await queryInterface.addIndex("Contacts", ["clientCode", "companyId"], {
            name: "idx_contacts_client_code_company"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeIndex("Contacts", "idx_contacts_client_code_company");
        await queryInterface.removeColumn("Contacts", "clientCode");
    }
};
