const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DB_HOST 
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
    : 'postgresql://postgres:postgres@localhost:5432/whaticket'
});

(async () => {
  try {
    await client.connect();
    
    // Verificar ticket 255 e seu contato
    const ticket255 = await client.query(`
      SELECT t.id as "ticketId", t.uuid, t.status, t."contactId",
             c.id, c.name, c.number, c."lidJid", c."remoteJid", c."canonicalNumber"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.id = 255
    `);
    console.log('\n=== TICKET 255 (frontend está aqui) ===');
    console.log(JSON.stringify(ticket255.rows, null, 2));

    // Verificar contato 6220 (novo contato criado com LID)
    const contact6220 = await client.query(`
      SELECT id, name, number, "lidJid", "remoteJid", "canonicalNumber"
      FROM "Contacts"
      WHERE id = 6220
    `);
    console.log('\n=== CONTATO 6220 (novo contato criado com LID) ===');
    console.log(JSON.stringify(contact6220.rows, null, 2));

    // Verificar ticket 300 (novo ticket criado)
    const ticket300 = await client.query(`
      SELECT t.id as "ticketId", t.uuid, t.status, t."contactId",
             c.id, c.name, c.number, c."lidJid", c."canonicalNumber"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.id = 300
    `);
    console.log('\n=== TICKET 300 (mensagem foi para aqui) ===');
    console.log(JSON.stringify(ticket300.rows, null, 2));

    // Verificar se existe contato com esse LID
    const contatosComLid = await client.query(`
      SELECT id, name, number, "lidJid", "remoteJid", "canonicalNumber"
      FROM "Contacts"
      WHERE "companyId" = 1 AND (
        "lidJid" = '255022357020825@lid' OR
        "remoteJid" = '255022357020825@lid'
      )
    `);
    console.log('\n=== CONTATOS COM LID 255022357020825@lid ===');
    console.log(JSON.stringify(contatosComLid.rows, null, 2));

    // Verificar contatos com número 559992461008
    const contatosComNumero = await client.query(`
      SELECT id, name, number, "lidJid", "remoteJid", "canonicalNumber"
      FROM "Contacts"
      WHERE "companyId" = 1 AND (
        number LIKE '%559992461008%' OR
        "canonicalNumber" LIKE '%559992461008%' OR
        number LIKE '%9992461008%' OR
        "canonicalNumber" LIKE '%9992461008%'
      )
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log('\n=== CONTATOS COM NÚMERO 559992461008 ===');
    console.log(JSON.stringify(contatosComNumero.rows, null, 2));

    await client.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await client.end();
  }
})();
