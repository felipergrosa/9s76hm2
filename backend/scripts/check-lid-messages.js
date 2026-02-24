const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'whaticket'
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Buscar contatos com @lid
    const contacts = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber"
      FROM "Contacts"
      WHERE ("remoteJid" LIKE '%@lid' OR "lidJid" IS NOT NULL)
        AND "isGroup" = false
      ORDER BY id DESC LIMIT 10
    `);
    console.log('=== CONTATOS COM @lid ===');
    contacts.rows.forEach(c => {
      console.log(`  ID:${c.id} name="${c.name}" number="${c.number}" remoteJid=${c.remoteJid} lidJid=${c.lidJid}`);
    });

    // 2. Buscar mensagens recentes de contatos @lid com dataJson
    const msgs = await client.query(`
      SELECT m.id, m.body, m."remoteJid" as msg_jid, m."fromMe",
             LEFT(m."dataJson"::text, 3000) as dj,
             c.name, c.number, c."remoteJid" as contact_jid
      FROM "Messages" m
      JOIN "Tickets" t ON m."ticketId" = t.id
      JOIN "Contacts" c ON t."contactId" = c.id
      WHERE (c."remoteJid" LIKE '%@lid' OR c."lidJid" IS NOT NULL)
        AND m."dataJson" IS NOT NULL
        AND m."dataJson"::text != 'null'
      ORDER BY m."createdAt" DESC LIMIT 3
    `);

    console.log('\n=== MENSAGENS RECENTES DE CONTATOS @lid ===');
    msgs.rows.forEach(row => {
      console.log('\n--- MSG ID:', row.id, '---');
      console.log('  contact:', row.name, '| number:', row.number, '| jid:', row.contact_jid);
      console.log('  body:', (row.body || '').substring(0, 60));
      console.log('  fromMe:', row.fromme);
      try {
        const d = JSON.parse(row.dj);
        console.log('  key:', JSON.stringify(d.key));
        console.log('  pushName:', d.pushName);
        console.log('  senderPn:', d.senderPn);
        console.log('  verifiedBizName:', d.verifiedBizName);
        // Campos importantes para LID
        const importantFields = Object.keys(d).filter(k => k !== 'message' && k !== 'key');
        console.log('  topLevelFields:', importantFields.join(', '));
        // Campos do key
        if (d.key) {
          console.log('  key fields:', Object.keys(d.key).join(', '));
          console.log('  remoteJidAlt:', d.key.remoteJidAlt);
          console.log('  participantAlt:', d.key.participantAlt);
        }
      } catch (e) {
        console.log('  dataJson parse error:', e.message);
      }
    });

    // 3. Buscar "Suporte Dinamico" especificamente
    const suporte = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber", "createdAt"
      FROM "Contacts"
      WHERE name ILIKE '%suporte din%'
    `);
    console.log('\n=== SUPORTE DINAMICO ===');
    suporte.rows.forEach(c => {
      console.log(`  ID:${c.id} name="${c.name}" number="${c.number}" remoteJid=${c.remoteJid} lidJid=${c.lidJid} canonical=${c.canonicalNumber} created=${c.createdAt}`);
    });

    // 4. Verificar LidMappings existentes
    const mappings = await client.query(`SELECT * FROM "LidMappings" ORDER BY "updatedAt" DESC LIMIT 10`);
    console.log('\n=== LID MAPPINGS ===');
    mappings.rows.forEach(m => {
      console.log(`  lid=${m.lid} phone=${m.phoneNumber} source=${m.source} confidence=${m.confidence} verified=${m.verified}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
