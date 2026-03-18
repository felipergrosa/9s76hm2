// backend/src/database/migrations/20260318000000-enforce-single-personal-tag.ts
// Migration: Garante que cada usuário tenha exatamente 1 tag pessoal obrigatória
// Remove a funcionalidade de múltiplas tags pessoais para simplificar o sistema

import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Verificar usuários sem nenhuma tag pessoal
    // allowedContactTags é integer[] (array nativo), não JSONB
    const usersWithoutTag = await queryInterface.sequelize.query(
      `SELECT id, name, "companyId" FROM "Users" 
       WHERE "allowedContactTags" IS NULL 
          OR array_length("allowedContactTags", 1) IS NULL
          OR array_length("allowedContactTags", 1) = 0`,
      { type: QueryTypes.SELECT }
    );

    if (Array.isArray(usersWithoutTag) && usersWithoutTag.length > 0) {
      console.log(`[Migration] ${usersWithoutTag.length} usuários sem tag pessoal.`);
      console.log("[Migration] Criando tags pessoais automaticamente...");

      for (const user of usersWithoutTag) {
        const userName = (user as any).name?.toString().toUpperCase().replace(/\s+/g, '-') || `USER-${(user as any).id}`;
        const companyId = (user as any).companyId;
        const userId = (user as any).id;

        // Verificar se tag já existe
        const existingTag = await queryInterface.sequelize.query(
          `SELECT id FROM "Tags" WHERE name = :name AND "companyId" = :companyId`,
          {
            replacements: { name: `#${userName}`, companyId },
            type: QueryTypes.SELECT
          }
        );

        let tagId: number;

        if (Array.isArray(existingTag) && existingTag.length > 0) {
          tagId = (existingTag[0] as any).id;
          console.log(`[Migration] Tag #${userName} já existe (ID: ${tagId})`);
        } else {
          // Criar tag pessoal
          const [result] = await queryInterface.sequelize.query(
            `INSERT INTO "Tags" (name, color, "companyId", "createdAt", "updatedAt") 
             VALUES (:name, '#008069', :companyId, NOW(), NOW())
             RETURNING id`,
            {
              replacements: { name: `#${userName}`, companyId },
              type: QueryTypes.INSERT
            }
          );
          tagId = (result as any)[0]?.id;
          console.log(`[Migration] Tag #${userName} criada (ID: ${tagId})`);
        }

        // Atribuir tag ao usuário (integer[] array nativo)
        await queryInterface.sequelize.query(
          `UPDATE "Users" 
           SET "allowedContactTags" = ARRAY[:tagId]::integer[]
           WHERE id = :userId`,
          {
            replacements: { tagId, userId },
            type: QueryTypes.UPDATE
          }
        );
      }
    }

    // 2. Verificar usuários com múltiplas tags pessoais (só manter a primeira)
    const usersWithMultipleTags = await queryInterface.sequelize.query(
      `SELECT id, name, "allowedContactTags" FROM "Users" 
       WHERE "allowedContactTags" IS NOT NULL 
         AND array_length("allowedContactTags", 1) > 1`,
      { type: QueryTypes.SELECT }
    );

    if (Array.isArray(usersWithMultipleTags) && usersWithMultipleTags.length > 0) {
      console.log(`[Migration] ${usersWithMultipleTags.length} usuários com múltiplas tags.`);
      console.log("[Migration] Mantendo apenas a primeira tag de cada usuário...");

      for (const user of usersWithMultipleTags) {
        const userId = (user as any).id;
        const tags = (user as any).allowedContactTags;
        const firstTag = tags[0];

        await queryInterface.sequelize.query(
          `UPDATE "Users" 
           SET "allowedContactTags" = ARRAY[:tagId]::integer[]
           WHERE id = :userId`,
          {
            replacements: { tagId: firstTag, userId },
            type: QueryTypes.UPDATE
          }
        );

        console.log(`[Migration] Usuário ${userId}: mantida apenas tag ${firstTag}`);
      }
    }

    console.log("[Migration] ✅ Validação de tag única por usuário concluída");
  },

  down: async (queryInterface: QueryInterface) => {
    // Não há rollback necessário - esta migration apenas normaliza dados
    console.log("[Migration] Rollback não aplicável para normalização de tags");
  }
};
