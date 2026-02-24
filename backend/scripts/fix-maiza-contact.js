const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

async function fixMaizaContact() {
  const client = await pool.connect();
  try {
    // Buscar o contato correto (com número)
    const correctContact = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid"
      FROM "Contacts"
      WHERE name = 'Maiza Brucieri Rosa'
        AND number ~ '^[0-9]+$'
        AND LENGTH(number) > 10
      LIMIT 1;
    `);
    
    // Buscar o contato incorreto (com nome no lugar do número)
    const wrongContact = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "companyId"
      FROM "Contacts"
      WHERE id = 6215;
    `);
    
    console.log('=== CONTATO CORRETO ===');
    if (correctContact.rows.length > 0) {
      const c = correctContact.rows[0];
      console.log(`ID: ${c.id}`);
      console.log(`Name: ${c.name}`);
      console.log(`Number: ${c.number}`);
      console.log(`remoteJid: ${c.remoteJid}`);
      console.log(`lidJid: ${c.lidJid}`);
    } else {
      console.log('Não encontrado contato correto');
    }
    
    console.log('\n=== CONTATO INCORRETO (Ticket 293) ===');
    if (wrongContact.rows.length > 0) {
      const w = wrongContact.rows[0];
      console.log(`ID: ${w.id}`);
      console.log(`Name: ${w.name}`);
      console.log(`Number: ${w.number}`);
      console.log(`remoteJid: ${w.remoteJid}`);
      console.log(`lidJid: ${w.lidJid}`);
      console.log(`companyId: ${w.companyId}`);
      
      // CORREÇÃO: Atualizar o número do contato incorreto
      if (correctContact.rows.length > 0) {
        const correctNumber = correctContact.rows[0].number;
        const correctRemoteJid = correctContact.rows[0].remoteJid;
        
        console.log('\n=== APLICANDO CORREÇÃO ===');
        
        await client.query(`
          UPDATE "Contacts"
          SET number = $1,
              "remoteJid" = $2,
              "updatedAt" = NOW()
          WHERE id = $3;
        `, [correctNumber, correctRemoteJid, w.id]);
        
        console.log(`✅ Contato ID ${w.id} atualizado:`);
        console.log(`   Number: ${correctNumber}`);
        console.log(`   remoteJid: ${correctRemoteJid}`);
        
        // Verificar se existe LidMapping
        if (w.lidJid) {
          const mapping = await client.query(`
            SELECT * FROM "LidMappings" WHERE lid = $1;
          `, [w.lidJid]);
          
          if (mapping.rows.length === 0) {
            // Criar LidMapping
            await client.query(`
              INSERT INTO "LidMappings" (lid, "phoneNumber", "companyId", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, NOW(), NOW());
            `, [w.lidJid, correctNumber, w.companyId]);
            console.log(`✅ LidMapping criado: ${w.lidJid} → ${correctNumber}`);
          } else {
            console.log(`ℹ️ LidMapping já existe: ${w.lidJid} → ${mapping.rows[0].phoneNumber}`);
          }
        }
        
        // Verificar ticket
        const ticket = await client.query(`
          SELECT id, status, "contactId" FROM "Tickets" WHERE id = 293;
        `);
        
        if (ticket.rows.length > 0) {
          console.log(`\nℹ️ Ticket 293: status=${ticket.rows[0].status}, contactId=${ticket.rows[0].contactId}`);
        }
      }
    } else {
      console.log('Contato incorreto não encontrado');
    }
    
    console.log('\n=== VERIFICAÇÃO FINAL ===');
    const final = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid"
      FROM "Contacts"
      WHERE id = 6215;
    `);
    
    if (final.rows.length > 0) {
      const f = final.rows[0];
      console.log(`Contato ID ${f.id}:`);
      console.log(`  Name: ${f.name}`);
      console.log(`  Number: ${f.number}`);
      console.log(`  remoteJid: ${f.remoteJid}`);
      console.log(`  lidJid: ${f.lidJid}`);
    }
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMaizaContact();
