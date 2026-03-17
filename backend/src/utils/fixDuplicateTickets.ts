/**
 * Script para unificar tickets duplicados
 * 
 * PROBLEMA: O código antigo criava novos tickets ao invés de reabrir tickets
 * fechados, causando duplicatas para o mesmo contato + conexão.
 * 
 * ESTRATÉGIA:
 * 1. Identificar grupos de tickets duplicados (mesmo contactId + whatsappId + companyId)
 * 2. Manter o ticket mais recente (maior ID) de cada grupo
 * 3. Mover mensagens dos tickets antigos para o ticket mantido
 * 4. Remover tickets duplicados antigos
 * 
 * Uso: npx ts-node src/utils/fixDuplicateTickets.ts [--dry-run]
 * 
 * --dry-run: Apenas mostra o que seria feito, sem executar
 */

import "../bootstrap";
import sequelize from "../database";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import { QueryTypes, Transaction } from "sequelize";
import logger from "./logger";

const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  try {
    console.log("=== VERIFICANDO TICKETS DUPLICADOS ===\n");
    
    if (DRY_RUN) {
      console.log("🔍 MODO DRY-RUN - Nenhuma alteração será feita\n");
    }

    // PASSO 0: Verificar duplicados
    const duplicates: Array<{
      contactId: number;
      whatsappId: number;
      companyId: number;
      total_tickets: number;
      ticket_ids: number[];
      statuses: string[];
    }> = await sequelize.query(`
      SELECT 
        "contactId",
        "whatsappId",
        "companyId",
        COUNT(*) as total_tickets,
        array_agg(id ORDER BY id DESC) as ticket_ids,
        array_agg(status ORDER BY id DESC) as statuses
      FROM "Tickets"
      WHERE "contactId" IS NOT NULL 
        AND "whatsappId" IS NOT NULL
        AND "isGroup" = false
      GROUP BY "contactId", "whatsappId", "companyId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `, { type: QueryTypes.SELECT });

    if (duplicates.length === 0) {
      console.log("✅ Nenhum ticket duplicado encontrado!");
      process.exit(0);
    }

    console.log(`❌ Encontrados ${duplicates.length} grupos de tickets duplicados:\n`);
    
    let totalToRemove = 0;
    duplicates.forEach((d, i) => {
      console.log(`${i + 1}. contactId=${d.contactId}, whatsappId=${d.whatsappId}`);
      console.log(`   Tickets: ${d.ticket_ids.join(', ')}`);
      console.log(`   Statuses: ${d.statuses.join(', ')}`);
      console.log(`   Manter: ${d.ticket_ids[0]} (${d.statuses[0]})`);
      console.log(`   Remover: ${d.ticket_ids.slice(1).join(', ')}\n`);
      totalToRemove += d.total_tickets - 1;
    });

    console.log(`Total de tickets a remover: ${totalToRemove}\n`);

    if (DRY_RUN) {
      console.log("🔍 DRY-RUN finalizado. Nenhuma alteração foi feita.");
      process.exit(0);
    }

    // PASSO 1: Buscar mapeamento de tickets duplicados com dados
    const mappingWithData: Array<{ 
      old_ticket_id: number; 
      keep_ticket_id: number;
      old_unread: number;
      old_updated: Date;
    }> = await sequelize.query(`
      WITH duplicate_groups AS (
        SELECT 
          id,
          "contactId",
          "whatsappId",
          "companyId",
          "unreadMessages",
          "updatedAt",
          ROW_NUMBER() OVER (
            PARTITION BY "contactId", "whatsappId", "companyId" 
            ORDER BY id DESC
          ) as rn
        FROM "Tickets"
        WHERE "contactId" IS NOT NULL 
          AND "whatsappId" IS NOT NULL
          AND "isGroup" = false
      )
      SELECT 
        dg.id as old_ticket_id, 
        kt.id as keep_ticket_id,
        dg."unreadMessages" as old_unread,
        dg."updatedAt" as old_updated
      FROM duplicate_groups dg
      JOIN duplicate_groups kt ON dg."contactId" = kt."contactId" 
          AND dg."whatsappId" = kt."whatsappId"
          AND dg."companyId" = kt."companyId"
      WHERE dg.rn > 1 AND kt.rn = 1
    `, { type: QueryTypes.SELECT });

    if (mappingWithData.length === 0) {
      console.log("✅ Nenhum ticket duplicado encontrado para merge!");
      process.exit(0);
    }

    console.log(`📋 Mapeados ${mappingWithData.length} tickets para merge`);

    // PASSO 2: Executar merge dentro de transação
    const transaction = await sequelize.transaction();

    try {
      // Mover mensagens
      for (const map of mappingWithData) {
        await sequelize.query(`
          UPDATE "Messages" SET "ticketId" = ? WHERE "ticketId" = ?
        `, { replacements: [map.keep_ticket_id, map.old_ticket_id], transaction });
      }
      console.log(`📨 Mensagens movidas`);

      // Mover outras relações
      const tables = ['"TicketTrackings"', '"TicketTags"', '"TicketLogMessages"', '"UserRatings"', '"LogTickets"'];
      for (const table of tables) {
        for (const map of mappingWithData) {
          try {
            await sequelize.query(`
              UPDATE ${table} SET "ticketId" = ? WHERE "ticketId" = ?
            `, { replacements: [map.keep_ticket_id, map.old_ticket_id], transaction });
          } catch (err: any) {
            // Ignorar tabelas que nao existem
          }
        }
      }

      // Atualizar dados do ticket mantido
      for (const map of mappingWithData) {
        await sequelize.query(`
          UPDATE "Tickets" 
          SET 
            "unreadMessages" = COALESCE("unreadMessages", 0) + ?,
            "updatedAt" = GREATEST("updatedAt", ?)
          WHERE id = ?
        `, { 
          replacements: [map.old_unread || 0, map.old_updated, map.keep_ticket_id], 
          transaction 
        });
      }

      // Remover tickets duplicados
      const oldIds = mappingWithData.map(m => m.old_ticket_id);
      const placeholders = oldIds.map(() => '?').join(',');
      await sequelize.query(`
        DELETE FROM "Tickets" WHERE id IN (${placeholders})
      `, { replacements: oldIds, transaction });
      
      console.log(`🗑️ ${oldIds.length} tickets duplicados removidos`);

      // Commit
      await transaction.commit();
      console.log("\n✅ Merge concluído com sucesso!");

    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    // Verificar resultado
    const remainingDuplicates: Array<{ count: string }> = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT 1
        FROM "Tickets"
        WHERE "contactId" IS NOT NULL 
          AND "whatsappId" IS NOT NULL
          AND "isGroup" = false
        GROUP BY "contactId", "whatsappId", "companyId"
        HAVING COUNT(*) > 1
      ) dup
    `, { type: QueryTypes.SELECT });

    console.log(`\n📊 Duplicados restantes: ${remainingDuplicates[0]?.count || 0}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  }
})();
