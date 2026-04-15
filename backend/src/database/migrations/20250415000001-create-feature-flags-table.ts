import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("FeatureFlags", {
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
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // Tipo de rollout
      rolloutType: {
        type: DataTypes.ENUM("boolean", "percentage", "user_segment", " gradual"),
        defaultValue: "boolean"
      },
      // Estado geral
      enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      // Configuração de rollout gradual
      percentage: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100
        }
      },
      // Segmentos de usuários (JSON array de userIds ou critérios)
      segments: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      // Entidades específicas (agentIds, queueIds, etc)
      targetEntities: {
        type: DataTypes.JSONB,
        defaultValue: {
          agentIds: [],
          queueIds: [],
          contactIds: []
        }
      },
      // Regras de targeting avançado
      targetingRules: {
        type: DataTypes.JSONB,
        defaultValue: {
          userGroups: [],
          plans: [],
          regions: []
        }
      },
      // Métricas de impacto
      metrics: {
        type: DataTypes.JSONB,
        defaultValue: {
          impressions: 0,
          enabledCount: 0,
          disabledCount: 0,
          errorCount: 0
        }
      },
      // Dados de experimento A/B
      experiment: {
        type: DataTypes.JSONB,
        defaultValue: {
          isExperiment: false,
          controlGroupPercentage: 50,
          startDate: null,
          endDate: null,
          winner: null
        }
      },
      // Dependências de outras flags
      dependencies: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      // Metadados
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          createdBy: null,
          lastModifiedBy: null,
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

    // Índices
    await queryInterface.addIndex("FeatureFlags", ["companyId", "key"], {
      unique: true
    });
    await queryInterface.addIndex("FeatureFlags", ["companyId", "enabled"]);
    await queryInterface.addIndex("FeatureFlags", ["rolloutType"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("FeatureFlags");
  }
};
