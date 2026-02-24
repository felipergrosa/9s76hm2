const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

async function findTestTickets() {
  const client = await pool.connect();
  try {
    // Buscar tickets abertos com contatos que têm @lid
    const result = await client.query(`
      SELECT t.id, t.status, t."contactId", t."whatsappId", t."isGroup", t."companyId",
             c.name, c.number, c."remoteJid", c."lidJid"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE (c."remoteJid" LIKE '%@lid%' OR c."lidJid" IS NOT NULL)
        AND t.status IN ('open', 'pending')
        AND t."isGroup" = false
      ORDER BY t."updatedAt" DESC
      LIMIT 5;
    `);
    
    console.log('=== TICKETS ABERTOS COM @lid ===');
    console.log(`Total: ${result.rows.length}`);
    console.log('');
    
    result.rows.forEach((row, i) => {
      console.log(`[${i + 1}] Ticket ID: ${row.id}`);
      console.log(`    Contato: ${row.name} (ID: ${row.contactId})`);
      console.log(`    Number: ${row.number}`);
      console.log(`    remoteJid: ${row.remoteJid}`);
      console.log(`    lidJid: ${row.lidJid}`);
      console.log(`    Status: ${row.status}`);
      console.log(`    WhatsAppId: ${row.whatsappId}`);
      console.log(`    isGroup: ${row.isGroup}`);
      console.log('');
    });
    
    // Verificar se há LidMapping para esses contatos
    if (result.rows.length > 0) {
      const lids = result.rows
        .map(r => r.lidJid || r.remoteJid)
        .filter(l => l && l.includes('@lid'));
      
      if (lids.length > 0) {
        const placeholders = lids.map((_, i) => `$${i + 1}`).join(',');
        const mappings = await client.query(`
          SELECT * FROM "LidMappings" 
          WHERE lid IN (${placeholders});
        `, lids);
        
        console.log('=== LID MAPPINGS PARA ESTES TICKETS ===');
        if (mappings.rows.length === 0) {
          console.log('❌ NENHUM MAPPING ENCONTRADO! Estes tickets vão falhar ao enviar.');
        } else {
          mappings.rows.forEach(m => {
            console.log(`✓ ${m.lid} → ${m.phoneNumber}`);
          });
        }
      }
    }
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

findTestTickets();
