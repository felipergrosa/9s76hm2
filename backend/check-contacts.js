const { Sequelize } = require('sequelize');
require('dotenv').config();

const seq = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    // Verificar ticket 255 e seu contato
    const [ticket255] = await seq.query(`
      SELECT t.id as ticketId, t.uuid, t.status, t.contactId,
             c.id, c.name, c.number, c.lidJid, c.canonicalNumber, c.remoteJid
      FROM Tickets t
      JOIN Contacts c ON c.id = t.contactId
      WHERE t.id = 255
    `);
    console.log('\n=== TICKET 255 (frontend está aqui) ===');
    console.log(JSON.stringify(ticket255, null, 2));

    // Verificar contato 6220 (novo contato criado)
    const [contact6220] = await seq.query(`
      SELECT id, name, number, lidJid, canonicalNumber, remoteJid
      FROM Contacts
      WHERE id = 6220
    `);
    console.log('\n=== CONTATO 6220 (novo contato criado com LID) ===');
    console.log(JSON.stringify(contact6220, null, 2));

    // Verificar se existe contato com esse número
    const [contatosComNumero] = await seq.query(`
      SELECT id, name, number, lidJid, canonicalNumber, remoteJid
      FROM Contacts
      WHERE companyId = 1 AND (
        number LIKE '%559992461008%' OR
        canonicalNumber LIKE '%559992461008%' OR
        number LIKE '%9992461008%' OR
        canonicalNumber LIKE '%9992461008%'
      )
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log('\n=== CONTATOS COM NÚMERO 559992461008 ===');
    console.log(JSON.stringify(contatosComNumero, null, 2));

    // Verificar ticket 300 (novo ticket criado)
    const [ticket300] = await seq.query(`
      SELECT t.id as ticketId, t.uuid, t.status, t.contactId,
             c.id, c.name, c.number, c.lidJid, c.canonicalNumber
      FROM Tickets t
      JOIN Contacts c ON c.id = t.contactId
      WHERE t.id = 300
    `);
    console.log('\n=== TICKET 300 (mensagem foi para aqui) ===');
    console.log(JSON.stringify(ticket300, null, 2));

    await seq.close();
  } catch (err) {
    console.error('Erro:', err.message);
    await seq.close();
  }
})();
