import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Remover duplicados antes de criar constraints (preparação)
    // Esta query mantém apenas o contato mais antigo de cada remoteJid duplicado
    await queryInterface.sequelize.query(`
      DELETE FROM "Contacts" c1
      USING "Contacts" c2
      WHERE c1.id > c2.id
        AND c1."companyId" = c2."companyId"
        AND c1."remoteJid" IS NOT NULL
        AND c2."remoteJid" IS NOT NULL
        AND c1."remoteJid" = c2."remoteJid";
    `);

    // 2. Adicionar constraint único para remoteJid + companyId
    // Evita que o mesmo JID (incluindo @lid) crie múltiplos contatos
    await queryInterface.addConstraint("Contacts", ["remoteJid", "companyId"], {
      type: "unique",
      name: "contacts_remotejid_companyid_unique"
    });

    // 3. Adicionar índice composto para canonicalNumber + companyId
    // Melhora performance e garante unicidade para números normalizados
    await queryInterface.addIndex("Contacts", {
      fields: ["canonicalNumber", "companyId"],
      name: "contacts_canonical_company_idx",
      unique: true,
      where: {
        canonicalNumber: {
          [require("sequelize").Op.ne]: null
        }
      }
    });

    console.log("✅ Constraints únicos adicionados para evitar contatos duplicados");
  },

  down: async (queryInterface: QueryInterface) => {
    // Remover constraint de remoteJid
    await queryInterface.removeConstraint(
      "Contacts",
      "contacts_remotejid_companyid_unique"
    );

    // Remover índice de canonicalNumber
    await queryInterface.removeIndex(
      "Contacts",
      "contacts_canonical_company_idx"
    );
  }
};
