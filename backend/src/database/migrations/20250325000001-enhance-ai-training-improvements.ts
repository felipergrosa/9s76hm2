import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    // Adiciona colunas de categorização
    await queryInterface.addColumn("AITrainingImprovements", "category", {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("AITrainingImprovements", "severity", {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("AITrainingImprovements", "intentDetected", {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null
    });

    // Adiciona métricas de impacto
    await queryInterface.addColumn("AITrainingImprovements", "verifiedInProduction", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("AITrainingImprovements", "improvementScore", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Altera ENUM de status para incluir 'rejected' e 'testing'
    await queryInterface.sequelize.query(
      `ALTER TABLE "AITrainingImprovements" ALTER COLUMN status TYPE VARCHAR(50)`
    );
    await queryInterface.sequelize.query(
      `UPDATE "AITrainingImprovements" SET status = 'pending' WHERE status NOT IN ('pending', 'applied')`
    );

    // Índices para análise
    await queryInterface.addIndex("AITrainingImprovements", ["category"]);
    await queryInterface.addIndex("AITrainingImprovements", ["severity"]);
    await queryInterface.addIndex("AITrainingImprovements", ["status"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("AITrainingImprovements", "category");
    await queryInterface.removeColumn("AITrainingImprovements", "severity");
    await queryInterface.removeColumn("AITrainingImprovements", "intentDetected");
    await queryInterface.removeColumn("AITrainingImprovements", "verifiedInProduction");
    await queryInterface.removeColumn("AITrainingImprovements", "improvementScore");
    
    await queryInterface.removeIndex("AITrainingImprovements", ["category"]);
    await queryInterface.removeIndex("AITrainingImprovements", ["severity"]);
    await queryInterface.removeIndex("AITrainingImprovements", ["status"]);
  }
};
