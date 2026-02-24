"use strict";

module.exports = {
  up: async (queryInterface: any) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1) Promover contatos LID quando existir LidMapping confiável (phoneNumber != lidDigits)
      //    IMPORTANTE: só promover quando NÃO existir outro contato com o mesmo número na empresa
      //    (evita erro de constraint/duplicidade em produção)
      await queryInterface.sequelize.query(
        `
        UPDATE "Contacts" c
        SET
          number = regexp_replace(lm."phoneNumber", '\\D', '', 'g'),
          "canonicalNumber" = regexp_replace(lm."phoneNumber", '\\D', '', 'g'),
          "remoteJid" = regexp_replace(lm."phoneNumber", '\\D', '', 'g') || '@s.whatsapp.net',
          "updatedAt" = NOW()
        FROM "LidMappings" lm
        WHERE
          c."isGroup" = false
          AND c."companyId" = lm."companyId"
          AND (
            c."lidJid" = lm.lid
            OR c."remoteJid" = lm.lid
          )
          AND lm."phoneNumber" IS NOT NULL
          AND regexp_replace(lm."phoneNumber", '\\D', '', 'g') ~ '^[0-9]{10,13}$'
          AND regexp_replace(lm."phoneNumber", '\\D', '', 'g') <> regexp_replace(COALESCE(c."lidJid", c."remoteJid"), '\\D', '', 'g')
          AND NOT EXISTS (
            SELECT 1
            FROM "Contacts" c2
            WHERE c2."companyId" = c."companyId"
              AND c2."isGroup" = false
              AND c2.id <> c.id
              AND (
                c2.number = regexp_replace(lm."phoneNumber", '\\D', '', 'g')
                OR c2."canonicalNumber" = regexp_replace(lm."phoneNumber", '\\D', '', 'g')
              )
          )
          AND (
            c.number IS NULL
            OR c.number LIKE 'PENDING_%'
            OR c.number !~ '^[0-9]+$'
            OR regexp_replace(c.number, '\\D', '', 'g') = regexp_replace(COALESCE(c."lidJid", c."remoteJid"), '\\D', '', 'g')
            OR c."remoteJid" IS NULL
            OR (
              c."remoteJid" LIKE '%@s.whatsapp.net'
              AND regexp_replace(c."remoteJid", '\\D', '', 'g') = regexp_replace(COALESCE(c."lidJid", c."remoteJid"), '\\D', '', 'g')
            )
          );
        `,
        { transaction }
      );

      // 2) Sanitizar contatos com LID que ainda estão inconsistentes: virar PENDING_<lid>@lid
      await queryInterface.sequelize.query(
        `
        UPDATE "Contacts" c
        SET
          number = 'PENDING_' || COALESCE(c."lidJid", c."remoteJid"),
          "canonicalNumber" = NULL,
          "remoteJid" = COALESCE(c."lidJid", c."remoteJid"),
          "updatedAt" = NOW()
        WHERE
          c."isGroup" = false
          AND COALESCE(c."lidJid", c."remoteJid") LIKE '%@lid'
          AND (
            c.number IS NULL
            OR c.number !~ '^[0-9]+$'
            OR c.number LIKE 'PENDING_%'
            OR regexp_replace(c.number, '\\D', '', 'g') = regexp_replace(COALESCE(c."lidJid", c."remoteJid"), '\\D', '', 'g')
            OR (
              c."remoteJid" LIKE '%@s.whatsapp.net'
              AND regexp_replace(c."remoteJid", '\\D', '', 'g') = regexp_replace(COALESCE(c."lidJid", c."remoteJid"), '\\D', '', 'g')
            )
          );
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async () => {
    // Migração de higienização: sem rollback automático seguro
  }
};
