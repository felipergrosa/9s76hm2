// backend/src/database/migrations/20260318000001-remove-contactwallet-table.ts
// Migration: Remove a tabela ContactWallet após migrar dados para ContactTags
// Toda a lógica de carteiras agora é feita através de tags pessoais (#)

import { QueryInterface, QueryTypes, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Verificar se há dados na ContactWallet que precisam ser migrados
    // allowedContactTags é integer[] (array nativo), não JSONB
    // Incluir companyId do contato para o INSERT
    const walletData = await queryInterface.sequelize.query(
      `SELECT cw."contactId", cw."walletId", u."allowedContactTags", c."companyId"
       FROM "ContactWallets" cw
       JOIN "Users" u ON cw."walletId" = u.id
       JOIN "Contacts" c ON cw."contactId" = c.id
       WHERE u."allowedContactTags" IS NOT NULL
         AND array_length(u."allowedContactTags", 1) > 0`,
      { type: QueryTypes.SELECT }
    );

    if (Array.isArray(walletData) && walletData.length > 0) {
      console.log(`[Migration] ${walletData.length} registros de wallet para migrar para ContactTags`);

      for (const record of walletData as any[]) {
        const contactId = record.contactId;
        const companyId = record.companyId;
        const userTagIds = record.allowedContactTags;
        
        // Para cada tag pessoal do usuário, criar vinculo na ContactTags
        for (const tagId of userTagIds) {
          // Verificar se já existe (ContactTags não tem coluna id, é chave composta)
          const existing = await queryInterface.sequelize.query(
            `SELECT "contactId" FROM "ContactTags" WHERE "contactId" = :contactId AND "tagId" = :tagId`,
            {
              replacements: { contactId, tagId },
              type: QueryTypes.SELECT
            }
          );

          if (!Array.isArray(existing) || existing.length === 0) {
            await queryInterface.sequelize.query(
              `INSERT INTO "ContactTags" ("contactId", "tagId", "companyId", "createdAt", "updatedAt")
               VALUES (:contactId, :tagId, :companyId, NOW(), NOW())`,
              {
                replacements: { contactId, tagId, companyId },
                type: QueryTypes.INSERT
              }
            );
            console.log(`[Migration] Tag ${tagId} vinculada ao contato ${contactId}`);
          }
        }
      }
    }

    // 2. Dropar a tabela ContactWallet
    await queryInterface.dropTable("ContactWallets");
    console.log("[Migration] ✅ Tabela ContactWallets removida com sucesso");

    // 3. Log de contatos sem nenhuma tag (potencial problema)
    const contactsWithoutTags = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM "Contacts" c
       WHERE NOT EXISTS (
         SELECT 1 FROM "ContactTags" ct WHERE ct."contactId" = c.id
       )`,
      { type: QueryTypes.SELECT }
    );

    const count = (contactsWithoutTags[0] as any)?.count || 0;
    if (count > 0) {
      console.log(`[⚠️ Atenção] ${count} contatos sem nenhuma tag após migração`);
      console.log(`[⚠️ Atenção] Esses contatos só serão visíveis para Super Admins`);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Recriar tabela ContactWallet (rollback)
    await queryInterface.createTable("ContactWallets", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      walletId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Contacts",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Adicionar índices
    await queryInterface.addIndex("ContactWallets", ["walletId"]);
    await queryInterface.addIndex("ContactWallets", ["contactId"]);
    await queryInterface.addIndex("ContactWallets", ["walletId", "contactId"], { unique: true });

    console.log("[Migration] Tabela ContactWallets recriada (rollback)");
  }
};
