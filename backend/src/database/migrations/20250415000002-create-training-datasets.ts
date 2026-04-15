import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Tabela de datasets de treinamento
    await queryInterface.createTable("TrainingDatasets", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "AIAgents",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      version: {
        type: DataTypes.STRING,
        defaultValue: "1.0.0"
      },
      format: {
        type: DataTypes.ENUM("openai", "anthropic", "gemini", "llama", "generic"),
        defaultValue: "openai"
      },
      // Estatísticas do dataset
      stats: {
        type: DataTypes.JSONB,
        defaultValue: {
          totalExamples: 0,
          totalTokens: 0,
          avgQuality: 0,
          categories: {}
        }
      },
      // Metadados
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          createdBy: null,
          source: "manual",
          tags: [],
          notes: ""
        }
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

    // Tabela de exemplos de treinamento
    await queryInterface.createTable("TrainingExamples", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      datasetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "TrainingDatasets",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Mensagens no formato de conversa
      messages: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // Metadados do exemplo
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          category: "general",
          quality: 1.0,
          source: "manual",
          agentId: null,
          ticketId: null,
          conversationId: null,
          tags: []
        }
      },
      // Informações de origem
      source: {
        type: DataTypes.ENUM("manual", "feedback", "conversation", "import"),
        defaultValue: "manual"
      },
      // Feedback associado
      feedbackId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Qualidade (0-1)
      quality: {
        type: DataTypes.FLOAT,
        defaultValue: 1.0,
        validate: {
          min: 0,
          max: 1
        }
      },
      // Tokens estimados
      tokens: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Se foi revisado por humano
      isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      verifiedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      verifiedAt: {
        type: DataTypes.DATE,
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
    await queryInterface.addIndex("TrainingDatasets", ["companyId", "agentId"]);
    await queryInterface.addIndex("TrainingDatasets", ["version"]);
    await queryInterface.addIndex("TrainingExamples", ["datasetId"]);
    await queryInterface.addIndex("TrainingExamples", ["companyId", "source"]);
    await queryInterface.addIndex("TrainingExamples", ["quality"]);
    await queryInterface.addIndex("TrainingExamples", ["isVerified"]);
    await queryInterface.addIndex("TrainingExamples", ["createdAt"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("TrainingExamples");
    await queryInterface.dropTable("TrainingDatasets");
  }
};
