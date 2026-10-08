import { QueryInterface, DataTypes } from "sequelize";

// Troncal SIP (referência Fluxoo): credenciais do troncal por empresa,
// consumidas pelo softphone (jssip/react-softphone) no frontend.
// - sipEnabled: "enabled"/"disabled" (padrão dos toggles de settings)
// - sipHost/sipPort/sipDomain: endpoint do servidor SIP (porta = WebSocket, ex.: 8089 no Asterisk)
// - sipUser/sipPassword: credenciais de registro (fallback quando o usuário não tem ramal)
// - sipTransport: "udp" | "tcp" | "wss" — no navegador sempre resolve para ws/wss
// - sipCallerId: identificador exibido nas chamadas (display_name)
// Todas STRING para manter compatibilidade com o endpoint genérico de update
// (UpdateCompanySettingsService grava :data como texto).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotente: só cria colunas que ainda não existem
      const settings = await queryInterface.describeTable("CompaniesSettings");

      if (!settings["sipEnabled"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "sipEnabled",
          {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "disabled"
          },
          { transaction }
        );
      }

      const stringColumns: Array<[string, string | null]> = [
        ["sipHost", null],
        ["sipPort", null],
        ["sipDomain", null],
        ["sipUser", null],
        // Senha do troncal: gravada em texto pelo endpoint genérico,
        // mas omitida/mascarada nas respostas de leitura (ver controller).
        ["sipPassword", null],
        ["sipCallerId", null]
      ];

      for (const [column, defaultValue] of stringColumns) {
        if (!settings[column]) {
          await queryInterface.addColumn(
            "CompaniesSettings",
            column,
            { type: DataTypes.STRING, allowNull: true, defaultValue },
            { transaction }
          );
        }
      }

      if (!settings["sipTransport"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "sipTransport",
          {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "wss"
          },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const settings = await queryInterface.describeTable("CompaniesSettings");

      const columns = [
        "sipTransport",
        "sipCallerId",
        "sipPassword",
        "sipUser",
        "sipDomain",
        "sipPort",
        "sipHost",
        "sipEnabled"
      ];

      for (const column of columns) {
        if (settings[column]) {
          await queryInterface.removeColumn("CompaniesSettings", column, { transaction });
        }
      }
    });
  }
};
