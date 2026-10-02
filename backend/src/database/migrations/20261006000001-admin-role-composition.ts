import { QueryInterface } from "sequelize";

/**
 * Migration: composição de permissões do admin via Roles (fase 3).
 *
 * profile="admin" deixa de conceder permissões automaticamente quando o
 * usuário tem Roles atribuídas — o set efetivo passa a ser composto por
 * base + flags + ACL pontual + permissões das Roles.
 *
 * up:
 *  (i)  cria, para cada empresa, a Role de sistema "Administrador" com
 *       TODAS as permissões de getAdminPermissions() (literal inline —
 *       extraído de modules/permissions/catalog.ts em 06/10/2026), de forma
 *       idempotente (WHERE NOT EXISTS por companyId+name);
 *  (ii) vincula cada Users.profile='admin' à Role "Administrador" da
 *       própria companyId, com NOT EXISTS por causa do índice único
 *       user_roles_user_id_role_id_unique (userId+roleId).
 *
 * down: remove os vínculos e as Roles marcadas pela description exata
 * (UserRoles.roleId já tem onDelete CASCADE — o DELETE explícito é
 * redundância defensiva caso o FK mude).
 */

// Literal extraído de getAdminPermissions() em modules/permissions/catalog.ts
const ADMIN_PERMISSIONS = [
  "tickets.view",
  "tickets.create",
  "tickets.update",
  "tickets.transfer",
  "tickets.close",
  "tickets.delete",
  "tickets.view-all",
  "tickets.view-groups",
  "tickets.view-all-historic",
  "tickets.view-all-users",
  "tickets.bulk-process",
  "tickets.bulk-edit-status",
  "tickets.bulk-edit-queue",
  "tickets.bulk-edit-user",
  "tickets.bulk-edit-tags",
  "tickets.bulk-edit-wallets",
  "tickets.bulk-edit-response",
  "tickets.bulk-edit-close",
  "tickets.bulk-edit-notes",
  "quick-messages.view",
  "quick-messages.create",
  "quick-messages.edit",
  "quick-messages.delete",
  "contacts.view",
  "contacts.create",
  "contacts.edit",
  "contacts.edit-fields",
  "contacts.edit-tags",
  "contacts.edit-wallets",
  "contacts.edit-representative",
  "contacts.delete",
  "contacts.import",
  "contacts.export",
  "contacts.bulk-edit",
  "tags.view",
  "tags.create",
  "tags.edit",
  "tags.delete",
  "helps.view",
  "dashboard.view",
  "reports.view",
  "realtime.view",
  "campaigns.view",
  "campaigns.create",
  "campaigns.edit",
  "campaigns.delete",
  "contact-lists.view",
  "contact-lists.create",
  "contact-lists.edit",
  "contact-lists.delete",
  "campaigns-config.view",
  "email-campaigns.view",
  "email-campaigns.create",
  "email-campaigns.edit",
  "email-campaigns.delete",
  "drip-sequences.view",
  "drip-sequences.create",
  "drip-sequences.edit",
  "drip-sequences.delete",
  "meta-templates.view",
  "meta-templates.create",
  "meta-templates.edit",
  "meta-templates.delete",
  "flowbuilder.view",
  "flowbuilder.create",
  "flowbuilder.edit",
  "flowbuilder.delete",
  "phrase-campaigns.view",
  "phrase-campaigns.create",
  "phrase-campaigns.edit",
  "phrase-campaigns.delete",
  "kanban.view",
  "schedules.view",
  "schedules.create",
  "schedules.edit",
  "schedules.delete",
  "internal-chat.view",
  "external-api.view",
  "prompts.view",
  "prompts.create",
  "prompts.edit",
  "prompts.delete",
  "integrations.view",
  "ai-agents.view",
  "ai-agents.create",
  "ai-agents.edit",
  "ai-agents.delete",
  "ai-training.view",
  "ai-chat-assistant.use",
  "announcements.view",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",
  "users.view",
  "users.create",
  "users.edit",
  "users.edit-own",
  "users.delete",
  "queues.view",
  "queues.create",
  "queues.edit",
  "queues.delete",
  "connections.view",
  "connections.create",
  "connections.edit",
  "connections.delete",
  "files.view",
  "files.upload",
  "files.delete",
  "financeiro.view",
  "financeiro.edit",
  "settings.view",
  "settings.edit",
  "ai-settings.view",
  "ai-settings.edit",
  "roles.view",
  "roles.create",
  "roles.edit",
  "roles.delete"
];

const ADMIN_ROLE_DESCRIPTION =
  "Role de sistema: administradores da empresa. Criada pela migração de composição de permissões.";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const permissionsJson = JSON.stringify(ADMIN_PERMISSIONS);

    // (i) Role "Administrador" por empresa — idempotente (NOT EXISTS por
    // companyId+name). permissions é coluna JSON → cast explícito ::json.
    await queryInterface.sequelize.query(
      `
      INSERT INTO "Roles" ("name", "description", "permissions", "companyId", "createdAt", "updatedAt")
      SELECT 'Administrador', :description, CAST(:permissions AS json), c."id", NOW(), NOW()
      FROM "Companies" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "Roles" r
        WHERE r."companyId" = c."id" AND r."name" = 'Administrador'
      );
      `,
      {
        replacements: {
          description: ADMIN_ROLE_DESCRIPTION,
          permissions: permissionsJson
        }
      }
    );

    // (ii) Vincula cada admin à Role "Administrador" da própria empresa.
    // NOT EXISTS por (userId, roleId) — índice único user_roles_user_id_role_id_unique.
    await queryInterface.sequelize.query(
      `
      INSERT INTO "UserRoles" ("userId", "roleId", "companyId", "createdAt", "updatedAt")
      SELECT u."id", r."id", u."companyId", NOW(), NOW()
      FROM "Users" u
      JOIN "Roles" r
        ON r."companyId" = u."companyId"
       AND r."name" = 'Administrador'
      WHERE u."profile" = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM "UserRoles" ur
          WHERE ur."userId" = u."id" AND ur."roleId" = r."id"
        );
      `
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove primeiro os vínculos (defensivo — o FK UserRoles.roleId já tem
    // onDelete CASCADE) e depois as Roles marcadas pela description exata.
    await queryInterface.sequelize.query(
      `
      DELETE FROM "UserRoles" ur
      USING "Roles" r
      WHERE ur."roleId" = r."id" AND r."description" = :description;
      `,
      { replacements: { description: ADMIN_ROLE_DESCRIPTION } }
    );

    await queryInterface.sequelize.query(
      `
      DELETE FROM "Roles" WHERE "description" = :description;
      `,
      { replacements: { description: ADMIN_ROLE_DESCRIPTION } }
    );
  }
};
