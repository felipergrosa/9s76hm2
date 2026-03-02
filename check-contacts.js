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
    SELECT id, name, number, "canonicalNumber", "remoteJid", "lidJid"
    FROM "Contacts"
    WHERE name IN ('Elisinha Rosa', 'Maiza Brucieri Rosa', 'Leonardo', 'Nicole', 'Fernanda Rosa', 'Kelly', 'Heloisa', 'Allan Rosa')
    LIMIT 20
  `);
  
  console.log('Contatos encontrados:');
  results.forEach(c => {
    console.log(JSON.stringify(c, null, 2));
  });
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
