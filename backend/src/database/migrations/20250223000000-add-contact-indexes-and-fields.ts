import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("[Migration] Iniciando adição de índices e campos de contato...");

    // ═══════════════════════════════════════════════════════════════════
    // 1. Adicionar coluna canonicalNumber se não existir
    // ═══════════════════════════════════════════════════════════════════
    try {
      await queryInterface.addColumn("Contacts", "canonicalNumber", {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log("[Migration] Coluna canonicalNumber adicionada");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("[Migration] Coluna canonicalNumber já existe");
      } else {
        throw error;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. Adicionar coluna lidJid se não existir
    // ═══════════════════════════════════════════════════════════════════
    try {
      await queryInterface.addColumn("Contacts", "lidJid", {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log("[Migration] Coluna lidJid adicionada");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("[Migration] Coluna lidJid já existe");
      } else {
        throw error;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. Adicionar coluna pushName se não existir
    // ═══════════════════════════════════════════════════════════════════
    try {
      await queryInterface.addColumn("Contacts", "pushName", {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log("[Migration] Coluna pushName adicionada");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("[Migration] Coluna pushName já existe");
      } else {
        throw error;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. Adicionar índice para lidJid
    // ═══════════════════════════════════════════════════════════════════
    try {
      await queryInterface.addIndex("Contacts", ["lidJid"], {
        name: "idx_contacts_lidjid",
        where: { lidJid: { [require("sequelize").Op.ne]: null } }
      });
      console.log("[Migration] Índice lidJid adicionado");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("[Migration] Índice lidJid já existe");
      } else {
        console.log("[Migration] Erro ao adicionar índice lidJid:", error.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. Adicionar índice para canonicalNumber
    // ═══════════════════════════════════════════════════════════════════
    try {
      await queryInterface.addIndex("Contacts", ["canonicalNumber", "companyId"], {
        name: "idx_contacts_canonical_company"
      });
      console.log("[Migration] Índice canonicalNumber+companyId adicionado");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("[Migration] Índice canonicalNumber já existe");
      } else {
        console.log("[Migration] Erro ao adicionar índice canonicalNumber:", error.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. Adicionar índice único para (number, companyId, isGroup)
    // IMPORTANTE: Este índice PREVINE duplicatas no banco
    // ═══════════════════════════════════════════════════════════════════
    // Antes de criar, verificar se existem duplicatas
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT number, "companyId", "isGroup", COUNT(*) as count
      FROM "Contacts"
      WHERE number IS NOT NULL AND number != '' AND NOT number LIKE 'PENDING_%'
      GROUP BY number, "companyId", "isGroup"
      HAVING COUNT(*) > 1
    `);

    if ((duplicates as any[]).length > 0) {
      console.log(`[Migration] ALERTA: Encontradas ${(duplicates as any[]).length} duplicatas. Execute o script de deduplicação antes de criar o índice único.`);
      console.log("[Migration] O índice único NÃO será criado automaticamente.");
      console.log("[Migration] Execute: npx ts-node src/scripts/deduplicate-contacts.ts <companyId>");
    } else {
      try {
        await queryInterface.addIndex("Contacts", ["number", "companyId", "isGroup"], {
          unique: true,
          name: "unique_contact_per_company",
          where: {
            number: { [require("sequelize").Op.ne]: null },
            [require("sequelize").Op.and]: [
              { number: { [require("sequelize").Op.ne]: "" } },
              { number: { [require("sequelize").Op.notLike]: "PENDING_%" } }
            ]
          }
        });
        console.log("[Migration] ✅ Índice único (number, companyId, isGroup) criado com sucesso");
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          console.log("[Migration] Índice único já existe");
        } else {
          console.log("[Migration] Erro ao criar índice único:", error.message);
        }
      }
    }

    console.log("[Migration] ✅ Migração concluída");
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeIndex("Contacts", "unique_contact_per_company");
    } catch {}

    try {
      await queryInterface.removeIndex("Contacts", "idx_contacts_canonical_company");
    } catch {}

    try {
      await queryInterface.removeIndex("Contacts", "idx_contacts_lidjid");
    } catch {}

    try {
      await queryInterface.removeColumn("Contacts", "pushName");
    } catch {}

    try {
      await queryInterface.removeColumn("Contacts", "lidJid");
    } catch {}

    try {
      await queryInterface.removeColumn("Contacts", "canonicalNumber");
    } catch {}

    console.log("[Migration] ✅ Rollback concluído");
  }
};
