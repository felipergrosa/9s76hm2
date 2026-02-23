const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || (process.env.DB_HOST 
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
    : 'postgresql://postgres:postgres@localhost:5432/whaticket')
});

(async () => {
  try {
    await client.connect();

    console.log('\n=== 2. CONTATOS COM @g.us NO NÚMERO (TODOS) ===');
    const r2 = await client.query(`
      SELECT id, name, number, "isGroup"
      FROM "Contacts" 
      WHERE number LIKE '%@g.us'
      ORDER BY id DESC LIMIT 20
    `);
    console.table(r2.rows);

    await client.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await client.end();
  }
})();
