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
  // Verificar mensagens dos participantes que não foram resolvidos
  const [msgs] = await sequelize.query(`
    SELECT m.id, m.participant, m."senderName", m.body, m."fromMe", m."createdAt"
    FROM "Messages" m
    WHERE m.participant IN ('247540473708749@lid', '95687677083889@lid', '123557719863467@lid')
    ORDER BY m.id DESC
    LIMIT 20
  `);
  
  console.log('Mensagens dos participantes não resolvidos:');
  msgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
