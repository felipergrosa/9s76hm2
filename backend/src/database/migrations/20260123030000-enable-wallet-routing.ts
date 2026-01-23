import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration: Ativar Roteamento por Carteira (DirectTicketsToWallets)
 * 
 * Ativa a configuração que obriga o sistema a verificar a tabela ContactWallets
 * antes de criar um ticket. Isso é fundamental para a hierarquia funcionar.
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] ⚙️ ATIVANDO Roteamento por Carteira (DirectTicketsToWallets)...");

        try {
            // Atualiza para TRUE na empresa ID 1 (Padrão)
            // Se houver multi-tenancy, deveria ser para todas, mas vamos focar na empresa principal
            await sequelize.query(`
        UPDATE "CompaniesSettings"
        SET "DirectTicketsToWallets" = true, "updatedAt" = NOW()
        WHERE "companyId" = 1;
      `);

            console.log("[Migration] ✅ Configuração ativada com sucesso!");

            // Verifica resultado
            const [results]: any = await sequelize.query(`
        SELECT "DirectTicketsToWallets" FROM "CompaniesSettings" WHERE "companyId" = 1;
      `);
            console.log(`[Migration] Valor Atual: ${results[0]?.DirectTicketsToWallets}`);

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro: ${error.message}`);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;
        await sequelize.query(`
       UPDATE "CompaniesSettings"
       SET "DirectTicketsToWallets" = false
       WHERE "companyId" = 1;
    `);
        console.log("[Migration] Revertido.");
    }
};
