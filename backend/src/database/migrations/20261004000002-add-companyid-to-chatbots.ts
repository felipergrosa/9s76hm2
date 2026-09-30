import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Chatbots";
    const tableDefinition: any = await queryInterface.describeTable(table);

    // Coluna de isolamento por tenant — o chatbot era uma tabela global.
    if (!tableDefinition.companyId) {
      await queryInterface.addColumn(table, "companyId", {
        type: DataTypes.INTEGER,
        allowNull: true
      });
    }

    // Backfill (ordem de prioridade):
    // 1) chatbots vinculados a uma fila herdam o companyId da fila;
    await queryInterface.sequelize.query(`
      UPDATE "Chatbots" c
      SET "companyId" = q."companyId"
      FROM "Queues" q
      WHERE c."queueId" = q.id AND c."companyId" IS NULL
    `);

    // 2) raízes sem fila (queueId NULL) usam o companyId da fila apontada por optQueueId;
    await queryInterface.sequelize.query(`
      UPDATE "Chatbots" c
      SET "companyId" = q."companyId"
      FROM "Queues" q
      WHERE c."optQueueId" = q.id AND c."companyId" IS NULL
    `);

    // 3) nós filhos herdam o companyId do chatbot pai;
    await queryInterface.sequelize.query(`
      UPDATE "Chatbots" c
      SET "companyId" = p."companyId"
      FROM "Chatbots" p
      WHERE c."chatbotId" = p.id AND c."companyId" IS NULL
    `);

    // 4) decisão documentada: registros órfãos (sem nenhuma referência
    //    resolvível) recebem companyId = 1 (empresa principal/legada).
    await queryInterface.sequelize.query(`
      UPDATE "Chatbots" SET "companyId" = 1 WHERE "companyId" IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Chatbots", "companyId");
  }
};
