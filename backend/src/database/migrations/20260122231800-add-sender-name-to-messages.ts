import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration: Adiciona campo senderName à tabela Messages
 * 
 * Este campo armazena o nome de quem enviou a mensagem em grupos,
 * permitindo identificar o remetente mesmo quando não temos o contato cadastrado.
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        console.log("[Migration] Adicionando campo senderName à tabela Messages...");

        // Verificar se coluna já existe
        const tableDesc = await queryInterface.describeTable("Messages") as Record<string, any>;

        if (!tableDesc.senderName) {
            await queryInterface.addColumn("Messages", "senderName", {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: "Nome do remetente em mensagens de grupo (quando diferente do contato)"
            });
            console.log("[Migration] ✅ Coluna senderName adicionada com sucesso");
        } else {
            console.log("[Migration] ℹ️ Coluna senderName já existe");
        }
    },

    down: async (queryInterface: QueryInterface) => {
        console.log("[Migration] Removendo campo senderName da tabela Messages...");
        await queryInterface.removeColumn("Messages", "senderName");
        console.log("[Migration] ✅ Coluna senderName removida");
    }
};
