const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

async function run() {
  const client = await pool.connect();
  try {
    // Buscar contatos onde o campo "number" não é numérico (tem letras/espaços)
    const result = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber", "companyId", "createdAt"
      FROM "Contacts"
      WHERE "isGroup" = false
        AND number !~ '^[0-9@.]+$'
        AND number NOT LIKE 'PENDING_%'
      ORDER BY "createdAt" DESC
      LIMIT 30;
    `);

    console.log(`\n=== CONTATOS COM NOME NO CAMPO NUMBER (${result.rows.length}) ===`);
    result.rows.forEach(c => {
      console.log(`\nID: ${c.id}`);
      console.log(`  Name:          ${c.name}`);
      console.log(`  Number:        ${c.number}`);
      console.log(`  remoteJid:     ${c.remoteJid}`);
      console.log(`  lidJid:        ${c.lidJid}`);
      console.log(`  canonicalNum:  ${c.canonicalNumber}`);
      console.log(`  companyId:     ${c.companyId}`);
      console.log(`  createdAt:     ${c.createdAt}`);
    });

    // Buscar especificamente o "Suporte Dinâmico"
    const suporte = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber", "companyId"
      FROM "Contacts"
      WHERE name ILIKE '%Suporte Din%'
      LIMIT 5;
    `);

    console.log(`\n=== CONTATOS "SUPORTE DINÂMICO" (${suporte.rows.length}) ===`);
    suporte.rows.forEach(c => {
      console.log(`ID: ${c.id} | number: ${c.number} | remoteJid: ${c.remoteJid} | lidJid: ${c.lidJid}`);
    });

    // Buscar LidMappings para o remoteJid do Suporte Dinâmico
    if (suporte.rows.length > 0) {
      const s = suporte.rows[0];
      if (s.remoteJid) {
        const mapping = await client.query(`
          SELECT * FROM "LidMappings" WHERE lid = $1 OR lid = $2;
        `, [s.remoteJid, s.lidJid || '']);
        console.log(`\n=== LIDMAPPINGS para ${s.remoteJid} ===`);
        mapping.rows.forEach(m => console.log(m));
      }
    }

    // Buscar tickets do "Suporte Dinâmico"
    if (suporte.rows.length > 0) {
      const ids = suporte.rows.map(r => r.id);
      const tickets = await client.query(`
        SELECT id, status, "contactId", "whatsappId"
        FROM "Tickets"
        WHERE "contactId" = ANY($1::int[])
        ORDER BY id DESC
        LIMIT 5;
      `, [ids]);
      console.log(`\n=== TICKETS do Suporte Dinâmico ===`);
      tickets.rows.forEach(t => console.log(t));
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
