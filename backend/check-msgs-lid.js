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
  // Verificar mensagens com participant e contactId
  const [msgs] = await sequelize.query(`
    SELECT m.id, m.participant, m."contactId", m."ticketId", m."fromMe",
           c.name as "contactName", c.number as "contactNumber", c."isGroup" as "contactIsGroup"
    FROM "Messages" m
    LEFT JOIN "Contacts" c ON c.id = m."contactId"
    WHERE m.participant IN ('95687677083889@lid', '176609088803005@lid')
    ORDER BY m.id DESC
    LIMIT 10
  `);
  
  console.log('Mensagens com participant e contactId:');
  msgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
