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
  // Verificar mensagens do participante 176609088803005@lid
  const [msgs] = await sequelize.query(`
    SELECT m.id, m.participant, m."senderName", m.body, m."ticketId", t."contactId", c.name as "groupName"
    FROM "Messages" m
    JOIN "Tickets" t ON t.id = m."ticketId"
    JOIN "Contacts" c ON c.id = t."contactId"
    WHERE m.participant = '176609088803005@lid'
    ORDER BY m.id DESC
    LIMIT 10
  `);
  
  console.log('Mensagens do participante 176609088803005@lid:');
  if (msgs.length === 0) {
    console.log('NENHUMA mensagem encontrada');
  } else {
    msgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
  }
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
