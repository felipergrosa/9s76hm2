import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "MetaAutomationRules";

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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false
      },
      trigger: {
        type: DataTypes.STRING,
        allowNull: false
      },
      matchValue: {
        type: DataTypes.STRING,
        allowNull: true
      },
      dmText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      publicReplyText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      flowId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "FlowBuilders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      sentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastTriggeredAt: {
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

    // Cobre o matcher: companyId + whatsappId + trigger + active + channel
    await queryInterface.addIndex(
      table,
      ["companyId", "whatsappId", "trigger", "active"],
      { name: "meta_automation_rules_match_idx" }
    );

    // FK para FlowBuilders (lookup reverso e integridade)
    await queryInterface.addIndex(table, ["flowId"], {
      name: "meta_automation_rules_flow_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("MetaAutomationRules");
  }
};
