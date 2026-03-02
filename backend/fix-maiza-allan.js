const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function fix() {
  // Maiza Brucieri Rosa
  await sequelize.query(`
    UPDATE "Contacts"
    SET "lidJid" = '79121954660393@lid',
        "number" = '5519998938807',
        "canonicalNumber" = '5519998938807',
        "remoteJid" = '5519998938807@s.whatsapp.net'
    WHERE "companyId" = 1 AND "isGroup" = false 
      AND (name ILIKE '%Maiza%' OR number LIKE '%998938807%')
  `);
  console.log('Maiza atualizada');
  
  // Allan Rosa
  await sequelize.query(`
    UPDATE "Contacts"
    SET "lidJid" = '46093605830683@lid',
        "number" = '5519981670745',
        "canonicalNumber" = '5519981670745',
        "remoteJid" = '5519981670745@s.whatsapp.net'
    WHERE "companyId" = 1 AND "isGroup" = false 
      AND (name ILIKE '%Allan Rosa%' OR number LIKE '%981670745%')
  `);
  console.log('Allan atualizado');
  
  // Atualizar mensagens
  await sequelize.query(`
    UPDATE "Messages" SET "senderName" = 'Maiza Brucieri Rosa'
    WHERE participant = '79121954660393@lid' AND "senderName" IS NULL
  `);
  
  await sequelize.query(`
    UPDATE "Messages" SET "senderName" = 'Allan Rosa'
    WHERE participant = '46093605830683@lid' AND "senderName" IS NULL
  `);
  
  console.log('Mensagens atualizadas');
  await sequelize.close();
}

fix().catch(e => { console.error(e); process.exit(1); });
