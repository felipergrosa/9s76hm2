import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AITrainingFeedbacks", {
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
      sandboxSessionId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      messageIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      customerText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      assistantText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      rating: {
        type: DataTypes.ENUM("correct", "wrong"),
        allowNull: false
      },
      correctedText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      explanation: {
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

    await queryInterface.addIndex("AITrainingFeedbacks", ["companyId"], {
      name: "ai_training_feedback_company_idx"
    });
    await queryInterface.addIndex("AITrainingFeedbacks", ["companyId", "agentId"], {
      name: "ai_training_feedback_agent_idx"
    });
    await queryInterface.addIndex("AITrainingFeedbacks", ["companyId", "stageId"], {
      name: "ai_training_feedback_stage_idx"
    });
    await queryInterface.addIndex("AITrainingFeedbacks", ["companyId", "sandboxSessionId"], {
      name: "ai_training_feedback_session_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AITrainingFeedbacks");
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AITrainingFeedbacks_rating";');
    } catch (_) {
      // ignore
    }
  }
};
