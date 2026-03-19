/**
 * Script de Consolidação de Tickets por Contato + Conexão
 * 
 * OBJETIVO: Manter apenas 1 ticket por CONTATO + CONEXÃO (whatsappId)
 * 
 * Uso: node backend/database/scripts/consolidar-tickets.js [--dry-run] [--execute]
 * 
 * Flags:
 *   --dry-run   : Apenas mostrar o que seria feito (padrão)
 *   --execute   : Executar a migração de fato
 */

const { Sequelize } = require('sequelize');
require('dotenv').config({ path: __dirname + '/../../.env' });

// Criar conexão com o banco
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false
  }
);

const DRY_RUN = !process.argv.includes('--execute');

async function main() {
  console.log('============================================================');
  console.log('SCRIPT DE CONSOLIDAÇÃO DE TICKETS POR CONTATO + CONEXÃO');
  console.log('============================================================');
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (apenas diagnóstico)' : 'EXECUÇÃO REAL'}`);
  console.log(`Banco: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log('');

  try {
    await sequelize.authenticate();
    console.log('✓ Conexão com banco estabelecida\n');

    // ============================================================
    // PASSO 1: DIAGNÓSTICO
    // ============================================================
    console.log('--- PASSO 1: DIAGNÓSTICO ---\n');

    // 1.1 Total de grupos com múltiplos tickets
    const [diagnosticResult] = await sequelize.query(`
      SELECT 
        COUNT(*) as grupos_com_multiplos_tickets,
        SUM(ticket_count - 1) as tickets_a_remover
      FROM (
        SELECT 
          t."contactId",
          t."whatsappId",
          COUNT(t.id) as ticket_count
        FROM "Tickets" t
        WHERE t."isGroup" = false
        GROUP BY t."contactId", t."whatsappId"
        HAVING COUNT(t.id) > 1
      ) sub
    `);

    const stats = diagnosticResult[0];
    console.log(`Grupos (contato + conexão) com múltiplos tickets: ${stats.grupos_com_multiplos_tickets}`);
    console.log(`Tickets a remover: ${stats.tickets_a_remover}`);
    console.log('');

    // 1.2 Detalhes por CONTATO + CONEXÃO (top 20)
    const [details] = await sequelize.query(`
      SELECT 
        c.id as contact_id,
        c.name as contact_name,
        t."whatsappId" as conexao_id,
        w.name as conexao_nome,
        COUNT(t.id) as total_tickets,
        MAX(t.id) as ticket_a_manter,
        SUM((SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id)) as total_mensagens
      FROM "Contacts" c
      JOIN "Tickets" t ON t."contactId" = c.id
      LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
      WHERE t."isGroup" = false
      GROUP BY c.id, c.name, t."whatsappId", w.name
      HAVING COUNT(t.id) > 1
      ORDER BY COUNT(t.id) DESC
      LIMIT 20
    `);

    console.log('Top 20 grupos afetados:');
    console.log('-'.padEnd(100, '-'));
    console.log(
      'Contato'.padEnd(30) + 
      'Conexão'.padEnd(20) + 
      'Tickets'.padEnd(10) + 
      'Manter'.padEnd(10) + 
      'Mensagens'
    );
    console.log('-'.padEnd(100, '-'));
    
    for (const row of details) {
      console.log(
        (row.contact_name || 'N/A').substring(0, 28).padEnd(30) +
        (row.conexao_nome || row.conexao_id || 'N/A').toString().substring(0, 18).padEnd(20) +
        row.total_tickets.toString().padEnd(10) +
        row.ticket_a_manter.toString().padEnd(10) +
        (row.total_mensagens || 0).toString()
      );
    }
    console.log('');

    if (DRY_RUN) {
      console.log('============================================================');
      console.log('MODO DRY-RUN: Nenhuma alteração foi feita');
      console.log('Para executar a migração, use: node consolidar-tickets.js --execute');
      console.log('============================================================');
      return;
    }

    // ============================================================
    // PASSO 2: CRIAR MAPEAMENTO
    // ============================================================
    console.log('\n--- PASSO 2: CRIANDO MAPEAMENTO ---\n');

    // Buscar todos os tickets antigos que precisam ser consolidados
    const [ticketsToMigrate] = await sequelize.query(`
      SELECT 
        t.id as old_ticket_id,
        t."contactId",
        t."companyId",
        t."whatsappId",
        t.status as old_status,
        (
          SELECT MAX(t2.id) 
          FROM "Tickets" t2 
          WHERE t2."contactId" = t."contactId" 
            AND t2."companyId" = t."companyId"
            AND COALESCE(t2."whatsappId", 0) = COALESCE(t."whatsappId", 0)
            AND t2."isGroup" = false
        ) as new_ticket_id,
        (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id) as message_count
      FROM "Tickets" t
      WHERE t."isGroup" = false
        AND t.id < (
          SELECT MAX(t2.id) 
          FROM "Tickets" t2 
          WHERE t2."contactId" = t."contactId" 
            AND t2."companyId" = t."companyId"
            AND COALESCE(t2."whatsappId", 0) = COALESCE(t."whatsappId", 0)
            AND t2."isGroup" = false
        )
    `);

    const migrationMap = ticketsToMigrate.filter(t => t.old_ticket_id !== t.new_ticket_id);
    console.log(`Tickets a migrar: ${migrationMap.length}`);
    
    const totalMessages = migrationMap.reduce((sum, t) => sum + parseInt(t.message_count || 0), 0);
    console.log(`Mensagens a migrar: ${totalMessages}\n`);

    if (migrationMap.length === 0) {
      console.log('Nenhum ticket precisa ser consolidado.');
      return;
    }

    // ============================================================
    // PASSO 3: MIGRAR MENSAGENS
    // ============================================================
    console.log('--- PASSO 3: MIGRANDO MENSAGENS ---\n');

    let migratedMessages = 0;
    
    for (const ticket of migrationMap) {
      if (parseInt(ticket.message_count) > 0) {
        const [result] = await sequelize.query(`
          UPDATE "Messages" 
          SET "ticketId" = :newTicketId 
          WHERE "ticketId" = :oldTicketId
        `, {
          replacements: {
            newTicketId: ticket.new_ticket_id,
            oldTicketId: ticket.old_ticket_id
          }
        });
        
        migratedMessages += result.rowCount || parseInt(ticket.message_count);
        console.log(`  Ticket ${ticket.old_ticket_id} → ${ticket.new_ticket_id}: ${ticket.message_count} mensagens migradas`);
      }
    }

    console.log(`\nTotal de mensagens migradas: ${migratedMessages}\n`);

    // ============================================================
    // PASSO 4: MIGRAR OUTRAS REFERÊNCIAS
    // ============================================================
    console.log('--- PASSO 4: MIGRANDO OUTRAS REFERÊNCIAS ---\n');

    // TicketTraking
    try {
      for (const ticket of migrationMap) {
        await sequelize.query(`
          UPDATE "TicketTraking" 
          SET "ticketId" = :newTicketId 
          WHERE "ticketId" = :oldTicketId
        `, {
          replacements: {
            newTicketId: ticket.new_ticket_id,
            oldTicketId: ticket.old_ticket_id
          }
        });
      }
      console.log('  ✓ TicketTraking migrado');
    } catch (err) {
      console.log('  ! Tabela TicketTraking não encontrada ou vazia');
    }

    // LogTickets
    try {
      for (const ticket of migrationMap) {
        await sequelize.query(`
          UPDATE "LogTickets" 
          SET "ticketId" = :newTicketId 
          WHERE "ticketId" = :oldTicketId
        `, {
          replacements: {
            newTicketId: ticket.new_ticket_id,
            oldTicketId: ticket.old_ticket_id
          }
        });
      }
      console.log('  ✓ LogTickets migrado');
    } catch (err) {
      console.log('  ! Tabela LogTickets não encontrada ou vazia');
    }

    // TicketNotes
    try {
      for (const ticket of migrationMap) {
        await sequelize.query(`
          UPDATE "TicketNotes" 
          SET "ticketId" = :newTicketId 
          WHERE "ticketId" = :oldTicketId
        `, {
          replacements: {
            newTicketId: ticket.new_ticket_id,
            oldTicketId: ticket.old_ticket_id
          }
        });
      }
      console.log('  ✓ TicketNotes migrado');
    } catch (err) {
      console.log('  ! Tabela TicketNotes não encontrada ou vazia');
    }

    // ============================================================
    // PASSO 5: DELETAR TICKETS ANTIGOS
    // ============================================================
    console.log('\n--- PASSO 5: DELETANDO TICKETS ANTIGOS ---\n');

    const oldTicketIds = migrationMap.map(t => t.old_ticket_id);
    
    // Deletar em lotes para evitar timeout
    const batchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < oldTicketIds.length; i += batchSize) {
      const batch = oldTicketIds.slice(i, i + batchSize);
      const [result] = await sequelize.query(`
        DELETE FROM "Tickets" 
        WHERE id IN (:ids)
      `, {
        replacements: { ids: batch }
      });
      deletedCount += result.rowCount || batch.length;
      console.log(`  Deletados: ${deletedCount}/${oldTicketIds.length}`);
    }

    console.log(`\nTotal de tickets deletados: ${deletedCount}\n`);

    // ============================================================
    // PASSO 6: VALIDAÇÃO FINAL
    // ============================================================
    console.log('--- PASSO 6: VALIDAÇÃO FINAL ---\n');

    const [finalCheck] = await sequelize.query(`
      SELECT 
        COUNT(*) as grupos_com_multiplos_tickets
      FROM (
        SELECT 
          t."contactId",
          t."whatsappId",
          COUNT(t.id) as ticket_count
        FROM "Tickets" t
        WHERE t."isGroup" = false
        GROUP BY t."contactId", t."whatsappId"
        HAVING COUNT(t.id) > 1
      ) sub
    `);

    const [orphanCheck] = await sequelize.query(`
      SELECT COUNT(*) as mensagens_orfas
      FROM "Messages" m
      WHERE NOT EXISTS (SELECT 1 FROM "Tickets" t WHERE t.id = m."ticketId")
    `);

    const [summary] = await sequelize.query(`
      SELECT 
        'Tickets restantes (não grupo)' as metrica,
        COUNT(*) as valor
      FROM "Tickets" t
      WHERE t."isGroup" = false
      UNION ALL
      SELECT 
        'Mensagens totais' as metrica,
        COUNT(*) as valor
      FROM "Messages" m
      UNION ALL
      SELECT 
        'Contatos com tickets' as metrica,
        COUNT(DISTINCT "contactId") as valor
      FROM "Tickets" t
      WHERE t."isGroup" = false
    `);

    console.log('Resultado da validação:');
    console.log(`  Grupos com múltiplos tickets: ${finalCheck[0].grupos_com_multiplos_tickets}`);
    console.log(`  Mensagens órfãs: ${orphanCheck[0].mensagens_orfas}`);
    console.log('');
    console.log('Resumo:');
    for (const row of summary) {
      console.log(`  ${row.metrica}: ${row.valor}`);
    }

    console.log('\n============================================================');
    console.log('CONSOLIDAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('============================================================');

  } catch (error) {
    console.error('ERRO:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
