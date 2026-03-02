import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "sessionWindowExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true
    }).then(() => {
      // Adicionar índice para consultas rápidas
      return queryInterface.addIndex("Tickets", ["sessionWindowExpiresAt"], {
        name: "tickets_session_window_expires_at_idx"
      });
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeIndex("Tickets", "tickets_session_window_expires_at_idx")
      .then(() => {
        return queryInterface.removeColumn("Tickets", "sessionWindowExpiresAt");
      });
  }
};
