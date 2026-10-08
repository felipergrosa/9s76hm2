import { QueryInterface, DataTypes } from "sequelize";

// Config. Aniversário (referência Fluxoo):
// - Contacts.birthdate: data de nascimento do contato (alimenta o envio de parabéns)
// - Contacts.lastBirthdayGreetingAt: dia (fuso America/Sao_Paulo) do último envio — dedupe contato+dia
// - CompaniesSettings: toggle, template da mensagem e conexão de envio por empresa
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotente: só cria colunas que ainda não existem
      const contacts = await queryInterface.describeTable("Contacts");

      if (!contacts["birthdate"]) {
        await queryInterface.addColumn(
          "Contacts",
          "birthdate",
          { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!contacts["lastBirthdayGreetingAt"]) {
        await queryInterface.addColumn(
          "Contacts",
          "lastBirthdayGreetingAt",
          { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      const settings = await queryInterface.describeTable("CompaniesSettings");

      if (!settings["birthdayMessageEnabled"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "birthdayMessageEnabled",
          {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "disabled" // padrão "enabled"/"disabled" das demais opções
          },
          { transaction }
        );
      }

      if (!settings["birthdayMessage"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "birthdayMessage",
          { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      // ID da conexão (Whatsapp.id) como string/vazio = conexão padrão.
      // STRING mantém compatibilidade com o endpoint genérico de update
      // (UpdateCompanySettingsService grava :data como texto).
      if (!settings["birthdayWhatsappId"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "birthdayWhatsappId",
          { type: DataTypes.STRING, allowNull: true, defaultValue: null },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const contacts = await queryInterface.describeTable("Contacts");
      const settings = await queryInterface.describeTable("CompaniesSettings");

      if (settings["birthdayWhatsappId"]) {
        await queryInterface.removeColumn("CompaniesSettings", "birthdayWhatsappId", { transaction });
      }
      if (settings["birthdayMessage"]) {
        await queryInterface.removeColumn("CompaniesSettings", "birthdayMessage", { transaction });
      }
      if (settings["birthdayMessageEnabled"]) {
        await queryInterface.removeColumn("CompaniesSettings", "birthdayMessageEnabled", { transaction });
      }
      if (contacts["lastBirthdayGreetingAt"]) {
        await queryInterface.removeColumn("Contacts", "lastBirthdayGreetingAt", { transaction });
      }
      if (contacts["birthdate"]) {
        await queryInterface.removeColumn("Contacts", "birthdate", { transaction });
      }
    });
  }
};
