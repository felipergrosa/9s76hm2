const { Sequelize } = require('sequelize');
require('dotenv').config({ path: __dirname + '/../../.env' });

const seq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    // Verificar todas as conexões
    const [connections] = await seq.query(`
      SELECT id, name, status, channel, qrcode
      FROM "Whatsapps"
      ORDER BY id
    `);
    console.log('Todas as conexoes:');
    console.log(JSON.stringify(connections, null, 2));
    
    await seq.close();
  } catch (e) {
    console.error('ERRO:', e.message);
    process.exit(1);
  }
})();
