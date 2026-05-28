const { Sequelize } = require('sequelize');
require('dotenv').config();

const seq = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    // Teste simples de conexão
    await seq.authenticate();
    console.log('Conexão com banco OK');

    // Verificar contatos específicos com campos de avatar
    const [contatos] = await seq.query(`
      SELECT id, name, number, "urlPicture", "profilePicUrl", "pictureUpdated", uuid
      FROM Contacts
      WHERE name IN ('Elisinha Rosa', 'Maiza Brucieri Rosa', 'Leonardo', 'Nicole', 'Fernanda Rosa', 'Kelly', 'Heloisa', 'Allan Rosa')
      ORDER BY id DESC
      LIMIT 20
    `);
    console.log('\n=== CONTATOS COM CAMPOS DE AVATAR ===');
    contatos.forEach(c => {
      console.log(`ID: ${c.id} | Nome: ${c.name} | urlPicture: ${c.urlPicture?.substring(0, 80) || 'NULL'} | profilePicUrl: ${c.profilePicUrl?.substring(0, 80) || 'NULL'} | pictureUpdated: ${c.pictureUpdated} | uuid: ${c.uuid}`);
    });

    await seq.close();
  } catch (err) {
    console.error('Erro:', err);
    await seq.close();
  }
})();
