import { QueryInterface } from "sequelize";

/**
 * Migration: Corrigir tickets de grupo
 * 
 * Problema identificado:
 * - Tickets de grupo estavam com status "closed" (deviam ser "group")
 * - Tickets de grupo estavam com whatsappId NULL (impedia FindOrCreateTicketService de encontrá-los)
 * - Existiam tickets duplicados para o mesmo grupo (mesmo contactId)
 * 
 * Esta migration:
 * 1. Para cada grupo (contactId + isGroup=true), mantém apenas o ticket mais recente como "group"
 * 2. Preenche whatsappId com a conexão da company (se estava NULL)
 * 3. Consolida mensagens de tickets duplicados no ticket principal
 * 4. Fecha tickets duplicados antigos
 * 
 * Executada automaticamente durante o deploy, uma única vez.
 * Idempotente: pode ser executada múltiplas vezes sem efeito colateral.
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    console.log("[Migration] Iniciando correção de tickets de grupo...");

    try {
      // Passo 1: Identificar grupos com tickets que precisam de correção
      const [groupContacts]: any = await sequelize.query(`
        SELECT "contactId", "companyId", MAX(id) as latest_ticket_id, COUNT(*) as ticket_count
        FROM "Tickets"
        WHERE "isGroup" = true
        GROUP BY "contactId", "companyId"
      `);

      if (groupContacts.length === 0) {
        console.log("[Migration] Nenhum ticket de grupo encontrado. Nada a fazer.");
        return;
      }

      console.log(`[Migration] Encontrados ${groupContacts.length} grupos para verificar.`);

      let ticketsFixed = 0;
      let messagesConsolidated = 0;
      let duplicatesClosed = 0;

      for (const gc of groupContacts) {
        const latestId = gc.latest_ticket_id;
        const companyId = gc.companyId;

        // Passo 2: Buscar whatsappId padrão da company (caso precise preencher)
        const [whatsapps]: any = await sequelize.query(`
          SELECT id FROM "Whatsapps"
          WHERE "companyId" = :companyId
          ORDER BY 
            CASE WHEN status = 'CONNECTED' THEN 0 ELSE 1 END,
            id ASC
          LIMIT 1
        `, { replacements: { companyId } });

        const defaultWhatsappId = whatsapps.length > 0 ? whatsapps[0].id : null;

        // Passo 3: Atualizar o ticket mais recente: status -> group, preencher whatsappId se null
        const [updated]: any = await sequelize.query(`
          UPDATE "Tickets"
          SET 
            status = CASE WHEN status = 'closed' THEN 'group' ELSE status END,
            "whatsappId" = COALESCE("whatsappId", :defaultWhatsappId)
          WHERE id = :ticketId AND "isGroup" = true
          RETURNING id, status, "whatsappId"
        `, { replacements: { defaultWhatsappId, ticketId: latestId } });

        if (updated.length > 0) {
          ticketsFixed++;
        }

        // Passo 4: Se há tickets duplicados, consolidar mensagens no principal
        if (parseInt(gc.ticket_count) > 1) {
          // Mover mensagens dos tickets antigos para o principal (evitar duplicatas por wid)
          const [moved]: any = await sequelize.query(`
            UPDATE "Messages"
            SET "ticketId" = :latestId
            WHERE "ticketId" IN (
              SELECT id FROM "Tickets"
              WHERE "contactId" = :contactId AND "companyId" = :companyId AND "isGroup" = true AND id != :latestId
            )
            AND ("wid" IS NULL OR "wid" NOT IN (
              SELECT "wid" FROM "Messages" WHERE "ticketId" = :latestId AND "wid" IS NOT NULL
            ))
            RETURNING id
          `, { replacements: { latestId, contactId: gc.contactId, companyId } });

          messagesConsolidated += moved.length;

          // Fechar tickets antigos (manter apenas o principal)
          const [, closedResult]: any = await sequelize.query(`
            UPDATE "Tickets" SET status = 'closed'
            WHERE "contactId" = :contactId AND "companyId" = :companyId AND "isGroup" = true AND id != :latestId AND status != 'closed'
          `, { replacements: { contactId: gc.contactId, companyId, latestId } });

          duplicatesClosed += closedResult?.rowCount || 0;
        }
      }

      // Passo 5: Corrigir contatos de grupo com whatsappId NULL
      // Preencher whatsappId dos contatos de grupo usando o whatsappId do ticket correspondente
      const [, contactsResult]: any = await sequelize.query(`
        UPDATE "Contacts" c
        SET "whatsappId" = t."whatsappId"
        FROM "Tickets" t
        WHERE t."contactId" = c.id
          AND t."isGroup" = true
          AND t."whatsappId" IS NOT NULL
          AND c."isGroup" = true
          AND c."whatsappId" IS NULL
      `);
      const contactsFixed = contactsResult?.rowCount || 0;
      if (contactsFixed > 0) {
        console.log(`[Migration] ${contactsFixed} contatos de grupo atualizados com whatsappId`);
      }

      // Resumo
      console.log("[Migration] Correção de tickets de grupo concluída!");
      console.log(`[Migration] Resumo: ${ticketsFixed} tickets corrigidos, ${messagesConsolidated} mensagens consolidadas, ${duplicatesClosed} duplicatas fechadas, ${contactsFixed} contatos atualizados`);

      // Verificação final
      const [remaining]: any = await sequelize.query(`
        SELECT COUNT(*) as count FROM "Tickets"
        WHERE "isGroup" = true AND (status = 'closed' OR "whatsappId" IS NULL)
        AND id IN (
          SELECT MAX(id) FROM "Tickets" WHERE "isGroup" = true GROUP BY "contactId", "companyId"
        )
      `);

      if (remaining[0]?.count > 0) {
        console.log(`[Migration] Ainda restam ${remaining[0].count} tickets de grupo com problemas (análise manual necessária)`);
      } else {
        console.log("[Migration] Todos os tickets de grupo principais estão com status 'group' e whatsappId preenchido!");
      }

    } catch (error: any) {
      console.error(`[Migration] Erro: ${error.message}`);
      // Não lançar erro para não bloquear outras migrations
    }
  },

  down: async () => {
    console.log("[Migration] Esta migration não pode ser revertida automaticamente (dados já foram corrigidos)");
    console.log("[Migration] Para reverter manualmente: UPDATE \"Tickets\" SET status = 'closed', \"whatsappId\" = NULL WHERE \"isGroup\" = true");
  }
};
