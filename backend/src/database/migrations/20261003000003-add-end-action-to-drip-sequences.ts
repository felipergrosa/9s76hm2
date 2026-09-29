import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "DripSequences";
    const def: any = await queryInterface.describeTable(table);

    // Ação executada quando o contato completa todas as etapas do follow-up:
    // none | move_tag (move de lane/tag) | ticket_status | assign_queue | assign_user
    if (!def.endAction) {
      await queryInterface.addColumn(table, "endAction", {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "none"
      });
    }

    // Tag/lane de destino para endAction = move_tag
    if (!def.endActionTagId) {
      await queryInterface.addColumn(table, "endActionTagId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tags", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }

    // Status do ticket para endAction = ticket_status (open | pending | closed)
    if (!def.endActionStatus) {
      await queryInterface.addColumn(table, "endActionStatus", {
        type: DataTypes.STRING(20),
        allowNull: true
      });
    }

    // Fila de destino para endAction = assign_queue (mover carteira)
    if (!def.endActionQueueId) {
      await queryInterface.addColumn(table, "endActionQueueId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }

    // Atendente de destino para endAction = assign_user
    if (!def.endActionUserId) {
      await queryInterface.addColumn(table, "endActionUserId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }

    // Janela de envio opcional (ex.: "08:00"–"20:00"): nextSendAt é reagendado
    // para o início da janela quando cair fora dela
    if (!def.sendWindowStart) {
      await queryInterface.addColumn(table, "sendWindowStart", {
        type: DataTypes.STRING(5),
        allowNull: true
      });
    }
    if (!def.sendWindowEnd) {
      await queryInterface.addColumn(table, "sendWindowEnd", {
        type: DataTypes.STRING(5),
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "DripSequences";
    await queryInterface.removeColumn(table, "sendWindowEnd");
    await queryInterface.removeColumn(table, "sendWindowStart");
    await queryInterface.removeColumn(table, "endActionUserId");
    await queryInterface.removeColumn(table, "endActionQueueId");
    await queryInterface.removeColumn(table, "endActionStatus");
    await queryInterface.removeColumn(table, "endActionTagId");
    await queryInterface.removeColumn(table, "endAction");
  }
};
