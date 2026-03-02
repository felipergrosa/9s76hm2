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
  // Verificar se o contato existe
  const [contacts] = await sequelize.query(`
    SELECT id, name, number, "canonicalNumber", "remoteJid", "lidJid"
    FROM "Contacts"
    WHERE "companyId" = 1
      AND "isGroup" = false
      AND (
        number LIKE '%9989848513%'
        OR "canonicalNumber" LIKE '%9989848513%'
        OR name ILIKE '%Ricardo Almeida%'
      )
  `);
  
  console.log('Contatos do Ricardo Almeida:');
  contacts.forEach(c => console.log(JSON.stringify(c, null, 2)));
  
  // Se encontrou, atualizar o lidJid
  if (contacts.length > 0) {
    const contact = contacts[0];
    console.log(`\nAtualizando contato ${contact.id} com lidJid=176609088803005@lid...`);
    
    await sequelize.query(`
      UPDATE "Contacts"
      SET "lidJid" = '176609088803005@lid'
      WHERE id = ${contact.id}
    `);
    
    console.log('Contato atualizado!');
    
    // Atualizar senderName das mensagens
    const [result] = await sequelize.query(`
      UPDATE "Messages"
      SET "senderName" = '${contact.name}'
      WHERE participant = '176609088803005@lid'
        AND "senderName" IS NULL
      RETURNING id
    `);
    
    console.log(`Mensagens atualizadas: ${result.length}`);
  }
  
  await sequelize.close();
}

check().catch(e => { console.error(e); process.exit(1); });
