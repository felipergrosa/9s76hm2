import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    // Tabela de Cenários de Teste
    await queryInterface.createTable("AITestScenarios", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AIAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FunnelStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      conversations: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "active"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Tabela de Resultados de Teste
    await queryInterface.createTable("AITestResults", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      scenarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AITestScenarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AIAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FunnelStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      promptUsed: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      results: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      overallScore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      passRate: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalTests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      passedTests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Tabela de Versões de Prompt
    await queryInterface.createTable("AIPromptVersions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AIAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FunnelStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      systemPrompt: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      changeDescription: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      changeType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "manual"
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      testScore: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Índices
    await queryInterface.addIndex("AITestScenarios", ["companyId"], { name: "ai_test_scenario_company_idx" });
    await queryInterface.addIndex("AITestScenarios", ["userId"], { name: "ai_test_scenario_user_idx" });
    await queryInterface.addIndex("AITestScenarios", ["agentId"], { name: "ai_test_scenario_agent_idx" });
    await queryInterface.addIndex("AITestScenarios", ["stageId"], { name: "ai_test_scenario_stage_idx" });

    await queryInterface.addIndex("AITestResults", ["companyId"], { name: "ai_test_result_company_idx" });
    await queryInterface.addIndex("AITestResults", ["userId"], { name: "ai_test_result_user_idx" });
    await queryInterface.addIndex("AITestResults", ["scenarioId"], { name: "ai_test_result_scenario_idx" });
    await queryInterface.addIndex("AITestResults", ["agentId"], { name: "ai_test_result_agent_idx" });
    await queryInterface.addIndex("AITestResults", ["stageId"], { name: "ai_test_result_stage_idx" });

    await queryInterface.addIndex("AIPromptVersions", ["companyId"], { name: "ai_prompt_version_company_idx" });
    await queryInterface.addIndex("AIPromptVersions", ["userId"], { name: "ai_prompt_version_user_idx" });
    await queryInterface.addIndex("AIPromptVersions", ["agentId"], { name: "ai_prompt_version_agent_idx" });
    await queryInterface.addIndex("AIPromptVersions", ["stageId"], { name: "ai_prompt_version_stage_idx" });
    await queryInterface.addIndex("AIPromptVersions", ["agentId", "stageId", "version"], { name: "ai_prompt_version_unique_idx" });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AITestResults");
    await queryInterface.dropTable("AITestScenarios");
    await queryInterface.dropTable("AIPromptVersions");
  }
};
