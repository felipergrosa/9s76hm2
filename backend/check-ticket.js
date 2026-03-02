const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function check() {
  // Verificar ticketId das mensagens
  const [msgs] = await sequelize.query(`
    SELECT m.id, m.participant, m."senderName", m."ticketId", t."contactId", c.name as "groupName"
    FROM "Messages" m
    JOIN "Tickets" t ON t.id = m."ticketId"
    JOIN "Contacts" c ON c.id = t."contactId"
    WHERE m.participant = '95687677083889@lid'
    ORDER BY m.id DESC
    LIMIT 5
  `);
  
  console.log('Mensagens do participante 95687677083889@lid:');
  msgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
  
  // Verificar tickets do grupo atual
  const [tickets] = await sequelize.query(`
    SELECT t.id, t."contactId", c.name
    FROM "Tickets" t
    JOIN "Contacts" c ON c.id = t."contactId"
    WHERE c.name LIKE '%Nobre%' AND t."isGroup" = true
  `);
  
  console.log('\nTickets do grupo Nobre:');
  tickets.forEach(t => console.log(JSON.stringify(t, null, 2)));
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
