import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AITrainingImprovements", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      feedbackId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      improvementText: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM("pending", "applied"),
        allowNull: false,
        defaultValue: "pending"
      },
      appliedAt: {
        type: DataTypes.DATE(6),
        allowNull: true
      },
      consolidatedPrompt: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      }
    });

    await queryInterface.addIndex("AITrainingImprovements", ["companyId"], {
      name: "ai_training_improvement_company_idx"
    });
    await queryInterface.addIndex("AITrainingImprovements", ["companyId", "agentId"], {
      name: "ai_training_improvement_agent_idx"
    });
    await queryInterface.addIndex("AITrainingImprovements", ["companyId", "stageId"], {
      name: "ai_training_improvement_stage_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AITrainingImprovements");
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AITrainingImprovements_status";');
    } catch (_) {
      
    }
  }
};
