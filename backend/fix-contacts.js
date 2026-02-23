/**
 * Script para corrigir contatos corrompidos no banco de dados
 * 
 * Problemas identificados:
 * 1. Contatos com nome no lugar do número (ex: "Gervasio" no campo number)
 * 2. Contatos PENDING_ que precisam de atualização
 * 
 * Uso: node fix-contacts.js
 */

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || (process.env.DB_HOST 
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
    : 'postgresql://postgres:postgres@localhost:5432/whaticket')
});

(async () => {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados.\n');

    // ============================================
    // 1. CONTATOS COM NOME NO LUGAR DO NÚMERO
    // ============================================
    console.log('=== 1. CONTATOS COM NOME NO LUGAR DO NÚMERO ===');
    
    // Buscar contatos onde number = name (e não é um número)
    const { rows: badContacts } = await client.query(`
      SELECT id, name, number, "lidJid", "remoteJid"
      FROM "Contacts" 
      WHERE number = name 
        AND "isGroup" = false
        AND number NOT LIKE '%@lid'
        AND number NOT LIKE 'PENDING_%'
        AND length(regexp_replace(number, '[^0-9]', '', 'g')) < 10
      ORDER BY id DESC
      LIMIT 50
    `);
    
    console.log(`Encontrados ${badContacts.length} contatos com nome no lugar do número.`);
    
    if (badContacts.length > 0) {
      console.log('\nExemplos:');
      console.table(badContacts.slice(0, 5));
      
      // Corrigir: definir number como PENDING_<lidJid> ou PENDING_<remoteJid>
      for (const contact of badContacts) {
        const pendingNumber = `PENDING_${contact.lidJid || contact.remoteJid || contact.id}`;
        
        await client.query(`
          UPDATE "Contacts" 
          SET number = $1
          WHERE id = $2
        `, [pendingNumber, contact.id]);
        
        console.log(`Contato ${contact.id} atualizado: "${contact.number}" → "${pendingNumber}"`);
      }
      
      console.log(`\n✅ ${badContacts.length} contatos corrigidos.`);
    }

    // ============================================
    // 2. CONTATOS DUPLICADOS POR LID
    // ============================================
    console.log('\n=== 2. CONTATOS DUPLICADOS POR LID ===');
    
    const { rows: duplicates } = await client.query(`
      SELECT "lidJid", COUNT(*) as qtd, array_agg(id ORDER BY id) as ids
      FROM "Contacts"
      WHERE "lidJid" IS NOT NULL
      GROUP BY "lidJid"
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Encontrados ${duplicates.length} LIDs com duplicatas.`);
    
    for (const dup of duplicates) {
      // Manter o mais recente (último ID), deletar os outros
      const keepId = dup.ids[dup.ids.length - 1];
      const deleteIds = dup.ids.slice(0, -1);
      
      console.log(`LID ${dup.lidJid}: mantendo ${keepId}, removendo ${deleteIds.join(', ')}`);
      
      // Atualizar tickets para apontar para o contato mantido
      await client.query(`
        UPDATE "Tickets" 
        SET "contactId" = $1 
        WHERE "contactId" = ANY($2::int[])
      `, [keepId, deleteIds]);
      
      // Deletar contatos duplicados
      await client.query(`
        DELETE FROM "Contacts" 
        WHERE id = ANY($1::int[])
      `, [deleteIds]);
    }
    
    console.log(`\n✅ ${duplicates.length} duplicatas resolvidas.`);

    // ============================================
    // 3. ESTATÍSTICAS FINAIS
    // ============================================
    console.log('\n=== ESTATÍSTICAS FINAIS ===');
    
    const { rows: stats } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE "isGroup" = true) as grupos,
        COUNT(*) FILTER (WHERE "isGroup" = false AND number LIKE 'PENDING_%') as pendentes,
        COUNT(*) FILTER (WHERE "isGroup" = false AND number NOT LIKE 'PENDING_%') as normais
      FROM "Contacts"
    `);
    
    console.table(stats[0]);

    await client.end();
    console.log('\n✅ Script concluído com sucesso!');
    
  } catch (err) {
    console.error('Erro:', err.message);
    await client.end();
    process.exit(1);
  }
})();
