import { QueryInterface, DataTypes } from "sequelize";

// Campos menores mapeados na referência Fluxoo:
// - Users.ramal: ramal interno do usuário (hoje só cadastro; futuramente SIP/softphone)
// - Contacts.cpfCnpj: guarda idempotente (já existem migrations antigas que criam)
// - Contacts.verificationCode: "Código de Verificação" livre do contato
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotente: só cria colunas que ainda não existem
      const users = await queryInterface.describeTable("Users");
      const contacts = await queryInterface.describeTable("Contacts");

      if (!users["ramal"]) {
        await queryInterface.addColumn(
          "Users",
          "ramal",
          { type: DataTypes.STRING, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!contacts["cpfCnpj"]) {
        await queryInterface.addColumn(
          "Contacts",
          "cpfCnpj",
          { type: DataTypes.STRING, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!contacts["verificationCode"]) {
        await queryInterface.addColumn(
          "Contacts",
          "verificationCode",
          { type: DataTypes.STRING, allowNull: true, defaultValue: null },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const users = await queryInterface.describeTable("Users");
      const contacts = await queryInterface.describeTable("Contacts");

      if (contacts["verificationCode"]) {
        await queryInterface.removeColumn("Contacts", "verificationCode", { transaction });
      }
      // cpfCnpj NÃO é removido aqui: coluna pré-existente de migrations antigas
      if (users["ramal"]) {
        await queryInterface.removeColumn("Users", "ramal", { transaction });
      }
    });
  }
};
