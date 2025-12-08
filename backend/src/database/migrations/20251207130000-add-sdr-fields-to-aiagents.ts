import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // SDR Enabled
    await queryInterface.addColumn("AIAgents", "sdrEnabled", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });

    // ICP (Ideal Customer Profile)
    await queryInterface.addColumn("AIAgents", "sdrICP", {
      type: DataTypes.JSON,
      defaultValue: {
        segments: [],
        sizes: [],
        regions: [],
        criteria: ""
      },
      allowNull: true
    });

    // Metodologia de qualificação
    await queryInterface.addColumn("AIAgents", "sdrMethodology", {
      type: DataTypes.STRING,
      defaultValue: "BANT",
      allowNull: true
    });

    // Perguntas de qualificação
    await queryInterface.addColumn("AIAgents", "sdrQualificationQuestions", {
      type: DataTypes.JSON,
      defaultValue: [
        { question: "Qual o volume de compras mensal da sua empresa?", type: "budget", points: 15 },
        { question: "Quem é responsável pelas decisões de compra?", type: "authority", points: 15 },
        { question: "Qual problema você está buscando resolver?", type: "need", points: 20 },
        { question: "Para quando você precisa dessa solução?", type: "timeline", points: 15 }
      ],
      allowNull: true
    });

    // Regras de scoring
    await queryInterface.addColumn("AIAgents", "sdrScoringRules", {
      type: DataTypes.JSON,
      defaultValue: {
        icpMatch: 20,
        hasCnpj: 15,
        hasEmail: 10,
        askedPrice: 25,
        mentionedUrgency: 20,
        requestedHuman: 30,
        answeredQuestion: 10
      },
      allowNull: true
    });

    // Score mínimo para transferir
    await queryInterface.addColumn("AIAgents", "sdrMinScoreToTransfer", {
      type: DataTypes.INTEGER,
      defaultValue: 70,
      allowNull: true
    });

    // Gatilhos de transferência
    await queryInterface.addColumn("AIAgents", "sdrTransferTriggers", {
      type: DataTypes.JSON,
      defaultValue: ["pediu_orcamento", "score_minimo"],
      allowNull: true
    });

    // Agendamento habilitado
    await queryInterface.addColumn("AIAgents", "sdrSchedulingEnabled", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });

    // Link do calendário
    await queryInterface.addColumn("AIAgents", "sdrCalendarLink", {
      type: DataTypes.STRING,
      allowNull: true
    });

    // Mensagem de agendamento
    await queryInterface.addColumn("AIAgents", "sdrSchedulingMessage", {
      type: DataTypes.TEXT,
      defaultValue: "Que tal agendarmos uma conversa com nosso especialista? Ele pode te ajudar a encontrar a melhor solução para sua necessidade.",
      allowNull: true
    });

    // Mensagem de handoff
    await queryInterface.addColumn("AIAgents", "sdrHandoffMessage", {
      type: DataTypes.TEXT,
      defaultValue: "Vou transferir você para um de nossos especialistas que poderá te ajudar com mais detalhes. Um momento!",
      allowNull: true
    });

    // Tag de lead quente
    await queryInterface.addColumn("AIAgents", "sdrHotLeadTag", {
      type: DataTypes.STRING,
      defaultValue: "lead_quente",
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AIAgents", "sdrEnabled");
    await queryInterface.removeColumn("AIAgents", "sdrICP");
    await queryInterface.removeColumn("AIAgents", "sdrMethodology");
    await queryInterface.removeColumn("AIAgents", "sdrQualificationQuestions");
    await queryInterface.removeColumn("AIAgents", "sdrScoringRules");
    await queryInterface.removeColumn("AIAgents", "sdrMinScoreToTransfer");
    await queryInterface.removeColumn("AIAgents", "sdrTransferTriggers");
    await queryInterface.removeColumn("AIAgents", "sdrSchedulingEnabled");
    await queryInterface.removeColumn("AIAgents", "sdrCalendarLink");
    await queryInterface.removeColumn("AIAgents", "sdrSchedulingMessage");
    await queryInterface.removeColumn("AIAgents", "sdrHandoffMessage");
    await queryInterface.removeColumn("AIAgents", "sdrHotLeadTag");
  }
};
