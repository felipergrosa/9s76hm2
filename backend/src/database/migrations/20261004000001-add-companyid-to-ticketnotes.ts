import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "TicketNotes";
    const tableDefinition: any = await queryInterface.describeTable(table);

    // Isolamento por empresa: notas de ticket passam a ser filtradas por companyId
    if (!tableDefinition.companyId) {
      await queryInterface.addColumn(table, "companyId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      });
    }

    // Backfill (Postgres): herda companyId do ticket relacionado
    await queryInterface.sequelize.query(
      `UPDATE "TicketNotes" tn SET "companyId" = t."companyId" FROM "Tickets" t WHERE tn."ticketId" = t.id AND tn."companyId" IS NULL`
    );

    // Fallback para notas associadas apenas ao contato (sem ticket)
    await queryInterface.sequelize.query(
      `UPDATE "TicketNotes" tn SET "companyId" = c."companyId" FROM "Contacts" c WHERE tn."contactId" = c.id AND tn."companyId" IS NULL`
    );

    // Coluna permanece nullable de propósito: notas órfãs (sem ticket/contato
    // válido) ficam invisíveis via filtro de tenant, sem perda de dados.
    await queryInterface.addIndex(table, ["companyId"], {
      name: "ticket_notes_companyid_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("TicketNotes", "ticket_notes_companyid_idx");
    await queryInterface.removeColumn("TicketNotes", "companyId");
  }
};
