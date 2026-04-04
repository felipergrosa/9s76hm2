import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "isGroupParticipant", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.sequelize.query(`
      UPDATE "Contacts" c
      SET "isGroupParticipant" = true
      WHERE c."isGroup" = false
        AND (c."remoteJid" IS NOT NULL OR c."lidJid" IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1
          FROM "Tickets" t
          WHERE t."contactId" = c."id"
            AND t."isGroup" = false
        )
        AND (
          c."name" IS NULL
          OR BTRIM(c."name") = ''
          OR REGEXP_REPLACE(COALESCE(c."name", ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(c."number", ''), '\\D', '', 'g')
          OR c."name" LIKE '+%'
        )
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "isGroupParticipant");
  }
};
