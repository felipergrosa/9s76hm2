import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "ContactReleaseRequests";

    const tableInfo: any = await queryInterface.showAllTables();
    if (Array.isArray(tableInfo) && tableInfo.map(String).includes(table)) {
      return;
    }

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      requesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      resolvedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "SET NULL",
        onDelete: "SET NULL"
      },
      resolvedAt: {
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

    await queryInterface.addIndex(table, ["companyId", "contactId"], {
      name: "contact_release_requests_company_contact_idx"
    });

    // Evitar spam: 1 solicitação pendente por contato/empresa
    await queryInterface.addIndex(table, ["companyId", "contactId"], {
      unique: true,
      where: { status: "pending" },
      name: "contact_release_requests_unique_pending"
    } as any);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ContactReleaseRequests");
  }
};
