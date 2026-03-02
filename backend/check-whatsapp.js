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
  const [results] = await sequelize.query(`
    SELECT id, name, status, "createdAt", "updatedAt"
    FROM "Whatsapps"
    WHERE "companyId" = 1
    ORDER BY id
  `);
  
  console.log('Status das conexões WhatsApp:');
  results.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
