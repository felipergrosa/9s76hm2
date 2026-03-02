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
  // Verificar se existem contatos com esses LIDs
  const [results] = await sequelize.query(`
    SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber"
    FROM "Contacts"
    WHERE "remoteJid" LIKE '%95687677083889%' 
       OR "remoteJid" LIKE '%176609088803005%'
       OR "lidJid" LIKE '%95687677083889%'
       OR "lidJid" LIKE '%176609088803005%'
    LIMIT 10
  `);
  
  console.log('Contatos com esses LIDs:', results.length);
  results.forEach(c => console.log(JSON.stringify(c, null, 2)));
  
  // Verificar mensagens desses participantes
  const [msgs] = await sequelize.query(`
    SELECT m.participant, m."fromMe", COUNT(*) as total
    FROM "Messages" m
    WHERE m.participant LIKE '%95687677083889%' 
       OR m.participant LIKE '%176609088803005%'
    GROUP BY m.participant, m."fromMe"
  `);
  
  console.log('\nMensagens desses participantes:', msgs.length);
  msgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
  
  // Verificar LidMapping
  const [lidMaps] = await sequelize.query(`
    SELECT lid, "phoneNumber", source, verified
    FROM "LidMappings"
    WHERE lid LIKE '%95687677083889%' 
       OR lid LIKE '%176609088803005%'
  `);
  
  console.log('\nLidMappings:', lidMaps.length);
  lidMaps.forEach(m => console.log(JSON.stringify(m, null, 2)));
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
