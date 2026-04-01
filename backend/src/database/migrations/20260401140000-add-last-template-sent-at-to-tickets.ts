import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "lastTemplateSentAt", {
      type: DataTypes.DATE,
      allowNull: true
    }).then(() => {
      // Adicionar índice para consultas rápidas
      return queryInterface.addIndex("Tickets", ["lastTemplateSentAt"], {
        name: "tickets_last_template_sent_at_idx"
      });
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeIndex("Tickets", "tickets_last_template_sent_at_idx")
      .then(() => {
        return queryInterface.removeColumn("Tickets", "lastTemplateSentAt");
      });
  }
};
