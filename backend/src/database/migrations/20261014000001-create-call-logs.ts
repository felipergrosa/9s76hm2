import { QueryInterface, DataTypes } from "sequelize";

// Tabela de log de chamadas (voz) — alimentada pelo microserviço de chamadas
// ("wacalls", referência Fluxoo) ou pelo provedor SIP futuro via POST /call-logs.
// Apenas leitura para usuários (relatório /call-report); escrita é service-to-service.
//
// direction/status/provider ficam como STRING (não ENUM) de propósito: ENUM no
// Postgres exige ALTER TYPE para novos valores — já houve dor disso em outras
// tabelas do projeto. A validação dos valores aceitos fica na camada de serviço.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "CallLogs";

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
      // Tenant — isolamento obrigatório em todas as queries
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Conexão WhatsApp/linha pela qual a chamada passou (opcional)
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Atendente que respondeu/originou a chamada (opcional — chamada perdida pode não ter)
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Contato associado ao número, quando resolvido (opcional)
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Número remoto da chamada (dígitos, formato E.164 sem "+")
      number: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // "in" = recebida | "out" = originada
      direction: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // "answered" | "missed" | "rejected" | "failed"
      status: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Duração efetiva da conversa em segundos (0 para perdidas/rejeitadas)
      durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      // Início do evento de chamada (ring)
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      // Fim da chamada — nulo quando não atendida/encerrada sem timestamp
      endedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // Origem do registro: "wacalls" (microserviço whatsmeow) | "sip" (PBX/softphone)
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "wacalls"
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

    // Consulta principal do relatório: filtro por tenant + range de data
    // (o leftmost companyId também cobre lookups por tenant sozinho)
    await queryInterface.addIndex(table, ["companyId", "startedAt"], {
      name: "call_logs_company_started_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CallLogs");
  }
};
