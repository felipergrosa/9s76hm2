import { QueryInterface, DataTypes, Op } from "sequelize";

/**
 * Fase 1 da arquitetura "PN-First com LID-Index":
 * 
 * 1. Adiciona coluna lidJid ao Contact (armazena LID completo, ex: "247540473708749@lid")
 * 2. Cria índice único parcial (lidJid + companyId) para busca rápida
 * 3. Popula lidJid a partir de remoteJid existentes que contenham @lid
 * 4. Adiciona campo verified ao LidMappings
 * 5. Marca contatos fantasma (dígitos de LID em number) como PENDING_
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Adicionar coluna lidJid ao Contact
      await queryInterface.addColumn(
        "Contacts",
        "lidJid",
        {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: "LID completo do WhatsApp (ex: 247540473708749@lid). Índice de lookup, nunca identificador primário."
        },
        { transaction }
      );

      // 2. Criar índice único parcial para lidJid + companyId
      await queryInterface.addIndex("Contacts", {
        fields: ["lidJid", "companyId"],
        name: "contacts_lidjid_company_unique",
        unique: true,
        where: { lidJid: { [Op.ne]: null } },
        transaction
      });

      // 3. Popular lidJid a partir de remoteJid existentes que contenham @lid
      await queryInterface.sequelize.query(
        `UPDATE "Contacts"
         SET "lidJid" = "remoteJid"
         WHERE "remoteJid" IS NOT NULL
           AND "remoteJid" LIKE '%@lid'
           AND "lidJid" IS NULL`,
        { transaction }
      );

      // 4. Marcar contatos fantasma: número com >13 dígitos e sem @g.us (provável LID em number)
      // Estes serão reconciliados pelo job assíncrono (Fase 4)
      await queryInterface.sequelize.query(
        `UPDATE "Contacts"
         SET "number" = 'PENDING_' || "remoteJid"
         WHERE "remoteJid" IS NOT NULL
           AND "remoteJid" LIKE '%@lid'
           AND "isGroup" = false
           AND LENGTH(REGEXP_REPLACE("number", '[^0-9]', '', 'g')) > 13
           AND "number" NOT LIKE 'PENDING_%'`,
        { transaction }
      );

      // 5. Adicionar campo verified ao LidMappings (se não existir)
      const lidMappingsColumns = await queryInterface.describeTable("LidMappings");
      if (!lidMappingsColumns["verified"]) {
        await queryInterface.addColumn(
          "LidMappings",
          "verified",
          {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            comment: "Se o mapeamento foi confirmado pelo WhatsApp via evento oficial"
          },
          { transaction }
        );
      }

      await transaction.commit();
      console.log("✅ Fase 1: lidJid adicionado ao Contact, contatos fantasma marcados como PENDING_");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Reverter contatos PENDING_ para o número original (extrair do lidJid)
      await queryInterface.sequelize.query(
        `UPDATE "Contacts"
         SET "number" = REGEXP_REPLACE("lidJid", '@lid$', '')
         WHERE "number" LIKE 'PENDING_%'
           AND "lidJid" IS NOT NULL`,
        { transaction }
      );

      // Remover índice
      await queryInterface.removeIndex(
        "Contacts",
        "contacts_lidjid_company_unique",
        { transaction }
      );

      // Remover coluna lidJid
      await queryInterface.removeColumn("Contacts", "lidJid", { transaction });

      // Remover campo verified do LidMappings
      const lidMappingsColumns = await queryInterface.describeTable("LidMappings");
      if (lidMappingsColumns["verified"]) {
        await queryInterface.removeColumn("LidMappings", "verified", { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
