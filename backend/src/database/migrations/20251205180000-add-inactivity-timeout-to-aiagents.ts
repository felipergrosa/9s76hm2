import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar coluna inactivityTimeoutMinutes
    await queryInterface.addColumn("AIAgents", "inactivityTimeoutMinutes", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    // Adicionar coluna inactivityAction
    await queryInterface.addColumn("AIAgents", "inactivityAction", {
      type: DataTypes.ENUM("close", "transfer"),
      allowNull: true,
      defaultValue: "close"
    });

    // Adicionar coluna inactivityMessage
    await queryInterface.addColumn("AIAgents", "inactivityMessage", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "Não recebi sua resposta. Vou encerrar nosso atendimento por enquanto. Se precisar de algo, é só me chamar novamente! 👋"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AIAgents", "inactivityTimeoutMinutes");
    await queryInterface.removeColumn("AIAgents", "inactivityAction");
    await queryInterface.removeColumn("AIAgents", "inactivityMessage");
    
    // Remover o ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AIAgents_inactivityAction";');
  }
};
