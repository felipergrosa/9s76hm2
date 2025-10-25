import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("TagRules", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      tagId: {
        type: DataTypes.INTEGER,
        references: { model: "Tags", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      field: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Campo do contato: representativeCode, region, segment, city, etc"
      },
      operator: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "equals",
        comment: "Operador: equals, contains, in, etc"
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Valor ou lista de valores (JSON array para operator 'in')"
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      logic: {
        type: DataTypes.STRING,
        defaultValue: "AND",
        allowNull: false,
        comment: "Lógica entre regras: AND ou OR"
      },
      lastAppliedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Última vez que a regra foi aplicada"
      },
      lastContactsAffected: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true,
        comment: "Quantidade de contatos afetados na última aplicação"
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
    return queryInterface.dropTable("TagRules");
  }
};
