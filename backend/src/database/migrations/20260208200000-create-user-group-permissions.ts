import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserGroupPermissions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Índice único para evitar duplicatas
    await queryInterface.addIndex("UserGroupPermissions", ["userId", "contactId", "companyId"], {
      unique: true,
      name: "idx_user_group_permissions_unique",
    });

    // Índice para busca rápida por userId + companyId
    await queryInterface.addIndex("UserGroupPermissions", ["userId", "companyId"], {
      name: "idx_user_group_permissions_user_company",
    });

    // Índice para busca por contactId (usado no filtro de tickets)
    await queryInterface.addIndex("UserGroupPermissions", ["contactId"], {
      name: "idx_user_group_permissions_contact",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("UserGroupPermissions");
  },
};
