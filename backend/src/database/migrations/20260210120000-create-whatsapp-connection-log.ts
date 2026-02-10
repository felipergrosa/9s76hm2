import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration: Criar tabela WhatsappConnectionLog
 * 
 * Registra o histórico de número <-> conexãoId para permitir
 * migração automática de tickets/mensagens quando uma conexão
 * é apagada e recriada com o mesmo número de telefone.
 * 
 * Garante que NUNCA se perca histórico ao recriar conexões.
 */
export default {
  up: async (queryInterface: QueryInterface) => {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT to_regclass('public."WhatsappConnectionLogs"') as exists`,
      { type: (queryInterface.sequelize as any).QueryTypes.SELECT }
    ) as any[];

    if (tableExists[0]?.exists) {
      console.log("[Migration] WhatsappConnectionLogs já existe, pulando criação.");
      return;
    }

    await queryInterface.createTable("WhatsappConnectionLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "ID da conexão WhatsApp"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "ID da empresa"
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Número de telefone normalizado (apenas dígitos, ex: 5519991244679)"
      },
      event: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: "Tipo de evento: connected, disconnected, deleted, migrated"
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Dados extras (ex: ticketsMigrados, conexãoOrigem, etc)"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Índice para busca rápida por número + empresa
    await queryInterface.addIndex("WhatsappConnectionLogs", ["phoneNumber", "companyId"], {
      name: "idx_conn_log_phone_company"
    });

    // Índice para busca por conexão
    await queryInterface.addIndex("WhatsappConnectionLogs", ["whatsappId"], {
      name: "idx_conn_log_whatsapp_id"
    });

    console.log("[Migration] WhatsappConnectionLogs criada com sucesso.");
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("WhatsappConnectionLogs");
  }
};
