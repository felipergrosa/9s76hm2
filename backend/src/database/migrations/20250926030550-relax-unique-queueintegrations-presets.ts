import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1) Remover constraints únicas em name e projectName (best effort, nomes podem variar)
    const constraintNames = [
      'QueueIntegrations_name_key',
      'queueintegrations_name_key',
      'QueueIntegrations_projectName_key',
      'queueintegrations_projectname_key'
    ];

    for (const c of constraintNames) {
      try {
        // Ignora erro se não existir
        // @ts-ignore
        await queryInterface.removeConstraint('QueueIntegrations', c);
      } catch (e) {
        // noop
      }
    }

    // 2) Relaxar colunas: remover unique e permitir null em projectName
    await queryInterface.changeColumn('QueueIntegrations', 'name', {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false
    });

    await queryInterface.changeColumn('QueueIntegrations', 'projectName', {
      type: DataTypes.STRING,
      allowNull: true,
      unique: false
    });

    // 3) Garantir unicidade por módulo (type) por empresa SOMENTE para presets
    //    Usando índice parcial (Postgres)
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "queue_integrations_unique_preset_by_company_type" ON "QueueIntegrations" ("companyId","type") WHERE "type" LIKE 'preset-%'`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Reverter apenas o índice parcial; não recriamos as uniques antigas
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "queue_integrations_unique_preset_by_company_type";'
    );

    // Opcionalmente, poderíamos voltar projectName para not null, mas manteremos flexível
    await queryInterface.changeColumn('QueueIntegrations', 'projectName', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }
};
