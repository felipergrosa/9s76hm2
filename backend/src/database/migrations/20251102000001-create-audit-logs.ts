import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("AuditLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      userName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Nome do usuário no momento da ação (cache para histórico)"
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Ação realizada: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc."
      },
      entity: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Entidade afetada: User, Contact, Campaign, Ticket, etc."
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "ID da entidade afetada"
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Detalhes adicionais em JSON"
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "IP do usuário"
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "User agent do navegador"
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("AuditLogs");
  }
};
