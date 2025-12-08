import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Horário de funcionamento
    await queryInterface.addColumn("AIAgents", "businessHours", {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "outOfHoursMessage", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    // Qualificação de Lead
    await queryInterface.addColumn("AIAgents", "requireLeadQualification", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "requiredLeadFields", {
      type: DataTypes.JSON,
      defaultValue: ["cnpj", "email"],
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "leadFieldMapping", {
      type: DataTypes.JSON,
      defaultValue: {
        "cnpj": "cnpj",
        "razaoSocial": "name",
        "email": "email",
        "nomeFantasia": "fantasyName",
        "cidade": "city",
        "segmento": "segment"
      },
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "qualifiedLeadTag", {
      type: DataTypes.STRING,
      defaultValue: "lead_qualificado",
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "leadQualificationMessage", {
      type: DataTypes.TEXT,
      defaultValue: "Para enviar nossa tabela de preços, preciso de algumas informações. Qual o CNPJ da sua empresa?",
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AIAgents", "businessHours");
    await queryInterface.removeColumn("AIAgents", "outOfHoursMessage");
    await queryInterface.removeColumn("AIAgents", "requireLeadQualification");
    await queryInterface.removeColumn("AIAgents", "requiredLeadFields");
    await queryInterface.removeColumn("AIAgents", "leadFieldMapping");
    await queryInterface.removeColumn("AIAgents", "qualifiedLeadTag");
    await queryInterface.removeColumn("AIAgents", "leadQualificationMessage");
  }
};
