const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

async function findLidContacts() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "companyId", "isGroup"
      FROM "Contacts" 
      WHERE "remoteJid" LIKE '%@lid%' OR "lidJid" IS NOT NULL 
      LIMIT 10;
    `);
    
    console.log('=== CONTATOS COM @lid ===');
    console.log(`Total encontrados: ${result.rows.length}`);
    console.log('');
    
    result.rows.forEach((row, i) => {
      console.log(`[${i + 1}] ID: ${row.id}`);
      console.log(`    Nome: ${row.name}`);
      console.log(`    Number: ${row.number}`);
      console.log(`    remoteJid: ${row.remoteJid}`);
      console.log(`    lidJid: ${row.lidJid}`);
      console.log(`    companyId: ${row.companyId}`);
      console.log(`    isGroup: ${row.isGroup}`);
      console.log('');
    });
    
    // Buscar também na tabela LidMappings
    const mappings = await client.query(`
      SELECT lm.*, c.name as contact_name
      FROM "LidMappings" lm
      LEFT JOIN "Contacts" c ON c.number = lm."phoneNumber"
      LIMIT 5;
    `);
    
    console.log('=== LID MAPPINGS ===');
    console.log(`Total: ${mappings.rows.length}`);
    mappings.rows.forEach((row, i) => {
      console.log(`[${i + 1}] LID: ${row.lid} → ${row.phoneNumber} (${row.contact_name || 'sem nome'})`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

findLidContacts();
