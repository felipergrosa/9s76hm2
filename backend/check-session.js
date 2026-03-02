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
  // Verificar status do WhatsApp
  const [whatsapps] = await sequelize.query(`
    SELECT id, name, status, channel, "createdAt", "updatedAt"
    FROM "Whatsapps"
    WHERE "companyId" = 1
  `);
  console.log('WhatsApp status:');
  whatsapps.forEach(w => console.log(JSON.stringify(w, null, 2)));
  
  // Verificar locks
  const [locks] = await sequelize.query(`
    SELECT * FROM "WbotLocks" WHERE "whatsappId" = 13
  `);
  console.log('\nLocks para whatsappId=13:');
  console.log(JSON.stringify(locks, null, 2));
  
  // Limpar locks se existirem
  if (locks.length > 0) {
    console.log('\nLimpando locks...');
    await sequelize.query(`DELETE FROM "WbotLocks" WHERE "whatsappId" = 13`);
    console.log('Locks removidos!');
  }
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
